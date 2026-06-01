import { app, shell, BrowserWindow, clipboard, ipcMain, dialog, Menu } from 'electron'
import { existsSync, statSync } from 'fs'
import { promises as fs } from 'fs'
import { isAbsolute, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createAppMenuTemplate, type MenuClickEvent } from './app-menu'
import { showBrowserWindowContextMenu } from './browser-window-context-menu'
import { type TreeItemContext } from './context-menu'
import { registerContextMenuIpcHandlers } from './context-menu-ipc'
import { getInitialRepositoryPath } from './initial-repository-path'
import {
  clearRecentFiles,
  createEmptySessionState,
  getRecentFileOpenPayload,
  mergeSessionState,
  normalizeSessionState,
  recordRecentRepository
} from './session-store'
import {
  openRecentFileMenuItem as openRecentFileMenuItemWithDependencies,
  openRecentRepositoryMenuItem as openRecentRepositoryMenuItemWithDependencies
} from './recent-navigation'
import { openRepositoryInNewWindow } from './open-repository-dialog'
import {
  getPreview,
  getBlame,
  checkoutBranch,
  loadRepository,
  openWorktree,
  saveFile,
  searchRepository
} from './repository-service'
import { registerRepositoryIpcHandlers } from './repository-ipc'
import { createRecentRepositoryState, createRepositorySessionReset } from './repository-session'
import { registerSessionIpcHandlers } from './session-ipc'
import { registerSettingsIpcHandlers } from './settings-ipc'
import { createSettingsStore } from './settings-store'
import { registerWindowIpcHandlers } from './window-ipc'
import { configureDirectoryIndexNames } from './repository-tree'
import {
  shouldOpenCurrentTabSearchFromInput,
  shouldOpenGlobalSearchFromInput
} from './window-shortcuts'
import {
  getBrowserWindowBounds,
  getSavedWindowState,
  mergeWindowStateIntoSession,
  readWindowState
} from './window-state'
import type {
  AppSettings,
  FileTabShortcutDirection,
  FileTabShortcutPosition,
  RecentFileState,
  RepositoryPayload,
  SessionState
} from '../shared/types'
import { defaultAppSettings } from '../shared/types'

const appName = 'Git Wikitree'

app.setName(appName)

const windows = new Set<BrowserWindow>()
const windowRepositoryPaths = new Map<BrowserWindow, string>()
const windowStateSaveTimers = new Map<BrowserWindow, ReturnType<typeof setTimeout>>()
let sessionState = createEmptySessionState()
let appSettings = defaultAppSettings

function getSessionFilePath(): string {
  return join(app.getPath('userData'), 'session.json')
}

function getSettingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function applySettings(settings: AppSettings): void {
  appSettings = settings
  configureDirectoryIndexNames(settings.homeFileNames)
}

async function readStoredSession(): Promise<SessionState> {
  try {
    const content = await fs.readFile(getSessionFilePath(), 'utf8')
    return normalizeSessionState(JSON.parse(content))
  } catch {
    return createEmptySessionState()
  }
}

async function writeStoredSession(nextSessionState = sessionState): Promise<void> {
  sessionState = normalizeSessionState(nextSessionState)
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(getSessionFilePath(), `${JSON.stringify(sessionState, null, 2)}\n`, 'utf8')
}

async function saveWindowState(browserWindow: BrowserWindow): Promise<void> {
  if (browserWindow.isDestroyed()) return

  const repoPath = windowRepositoryPaths.get(browserWindow)
  const windowState = readWindowState(browserWindow)

  sessionState = mergeWindowStateIntoSession(sessionState, repoPath, windowState)
  await writeStoredSession()
}

function scheduleWindowStateSave(browserWindow: BrowserWindow): void {
  const currentTimer = windowStateSaveTimers.get(browserWindow)
  if (currentTimer) clearTimeout(currentTimer)

  windowStateSaveTimers.set(
    browserWindow,
    setTimeout(() => {
      windowStateSaveTimers.delete(browserWindow)
      void saveWindowState(browserWindow)
    }, 350)
  )
}

function flushWindowStateSave(browserWindow: BrowserWindow): void {
  const currentTimer = windowStateSaveTimers.get(browserWindow)
  if (currentTimer) clearTimeout(currentTimer)
  windowStateSaveTimers.delete(browserWindow)
  void saveWindowState(browserWindow)
}

function sendOpenFile(targetWindow: BrowserWindow, file: RecentFileState): void {
  targetWindow.webContents.send('repository:open-file', getRecentFileOpenPayload(file))
}

function closeFocusedFileTabOrWindow(): void {
  const targetWindow = BrowserWindow.getFocusedWindow()
  if (!targetWindow) return

  targetWindow.webContents.send('tab:close-current-or-window')
}

function selectFocusedFileTabByShortcut(position: FileTabShortcutPosition): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('tab:select-by-shortcut', position)
}

function selectAdjacentFocusedFileTab(delta: FileTabShortcutDirection): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('tab:select-adjacent', delta)
}

function openGlobalSearch(): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('search:open-global')
}

function openCurrentTabSearch(): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('search:open-current-tab')
}

function saveCurrentFile(): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('file:save-current')
}

function openSettings(): void {
  BrowserWindow.getFocusedWindow()?.webContents.send('settings:open')
}

function createWindow(repoPath?: string, file?: RecentFileState, treeItem?: TreeItemContext): void {
  const savedWindowState = getSavedWindowState(sessionState, repoPath)
  const mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    ...getBrowserWindowBounds(sessionState, repoPath),
    minWidth: 1024,
    minHeight: 720,
    title: appName,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  windows.add(mainWindow)
  if (repoPath) windowRepositoryPaths.set(mainWindow, repoPath)

  mainWindow.on('close', () => {
    flushWindowStateSave(mainWindow)
  })
  mainWindow.on('closed', () => {
    const currentTimer = windowStateSaveTimers.get(mainWindow)
    if (currentTimer) clearTimeout(currentTimer)
    windowStateSaveTimers.delete(mainWindow)
    windows.delete(mainWindow)
    windowRepositoryPaths.delete(mainWindow)
  })

  mainWindow.on('resize', () => {
    scheduleWindowStateSave(mainWindow)
  })
  mainWindow.on('move', () => {
    scheduleWindowStateSave(mainWindow)
  })
  mainWindow.on('maximize', () => {
    scheduleWindowStateSave(mainWindow)
  })
  mainWindow.on('unmaximize', () => {
    scheduleWindowStateSave(mainWindow)
  })

  mainWindow.on('ready-to-show', () => {
    if (savedWindowState?.isMaximized) mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('context-menu', (_event, params) => {
    void showBrowserWindowContextMenu({
      targetWindow: mainWindow,
      params,
      repositoryPath: windowRepositoryPaths.get(mainWindow),
      language: appSettings.language,
      isDev: is.dev,
      openExternal: (url) => void shell.openExternal(url),
      writeClipboardText: (text) => clipboard.writeText(text)
    })
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (shouldOpenGlobalSearchFromInput(input)) {
      event.preventDefault()
      mainWindow.webContents.send('search:open-global')
      return
    }

    if (!shouldOpenCurrentTabSearchFromInput(input)) return

    event.preventDefault()
    mainWindow.webContents.send('search:open-current-tab')
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (treeItem) {
      mainWindow.webContents.send('repository:open-tree-item', treeItem)
    } else if (file) {
      sendOpenFile(mainWindow, file)
    } else if (repoPath) {
      mainWindow.webContents.send('repository:open-path', repoPath)
    }
  })
}

function openRecentRepositoryMenuItem(repoPath: string, event: MenuClickEvent): void {
  openRecentRepositoryMenuItemWithDependencies(repoPath, event, {
    getAllWindows: () => BrowserWindow.getAllWindows(),
    getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
    getWindowRepositoryPath: (window) => windowRepositoryPaths.get(window),
    createWindow
  })
}

function openRecentFileMenuItem(file: RecentFileState, event: MenuClickEvent): void {
  openRecentFileMenuItemWithDependencies(file, event, {
    getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
    getAllWindows: () => BrowserWindow.getAllWindows(),
    getWindowRepositoryPath: (window) => windowRepositoryPaths.get(window),
    sendOpenFile,
    createWindow
  })
}

async function clearRecentMenuItems(): Promise<void> {
  sessionState = clearRecentFiles(sessionState)
  await writeStoredSession()
  createAppMenu()
}

function recordLoadedRepository(repository: RepositoryPayload): void {
  sessionState = {
    ...sessionState,
    recentRepositories: recordRecentRepository(
      sessionState.recentRepositories,
      createRecentRepositoryState(repository)
    )
  }
}

async function activateRepositoryInWindow(
  sourceWindow: BrowserWindow | null | undefined,
  repository: RepositoryPayload
): Promise<void> {
  if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
  recordLoadedRepository(repository)
  sessionState = mergeSessionState(sessionState, createRepositorySessionReset(repository), {
    syncProjectSession: false
  })
  await writeStoredSession()
}

function createAppMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      createAppMenuTemplate({
        appName,
        platform: process.platform,
        language: appSettings.language,
        recentRepositories: sessionState.recentRepositories,
        recentFiles: sessionState.recentFiles,
        openRepository: () =>
          void openRepositoryInNewWindow({
            getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
            showOpenDialog: (browserWindowOrOptions, options) =>
              options
                ? dialog.showOpenDialog(browserWindowOrOptions as BrowserWindow, options)
                : dialog.showOpenDialog(browserWindowOrOptions),
            loadRepository,
            createWindow,
            showErrorBox: (title, content) => dialog.showErrorBox(title, content)
          }),
        openRecentRepository: openRecentRepositoryMenuItem,
        openRecentFile: openRecentFileMenuItem,
        clearRecent: () => void clearRecentMenuItems(),
        closeCurrentTabOrWindow: closeFocusedFileTabOrWindow,
        selectFileTabByShortcut: selectFocusedFileTabByShortcut,
        selectAdjacentFileTab: selectAdjacentFocusedFileTab,
        saveCurrentFile,
        openSettings,
        openCurrentTabSearch,
        openGlobalSearch,
        closeWindow: () => BrowserWindow.getFocusedWindow()?.close()
      })
    )
  )
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  const settingsStore = createSettingsStore(getSettingsFilePath())
  applySettings(await settingsStore.read())
  sessionState = await readStoredSession()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.miclle.gitwikitree')
  createAppMenu()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerWindowIpcHandlers({
    ipcMain,
    createWindow,
    getWindowFromWebContents: (webContents) => BrowserWindow.fromWebContents(webContents)
  })

  registerContextMenuIpcHandlers({
    ipcMain,
    getWindowFromWebContents: (webContents) => BrowserWindow.fromWebContents(webContents),
    buildMenuFromTemplate: (items) => Menu.buildFromTemplate(items),
    openTreeItemInNewWindow: (targetItem) => createWindow(undefined, undefined, targetItem),
    openExternal: (url) => void shell.openExternal(url),
    writeClipboardText: (text) => clipboard.writeText(text),
    getLanguage: () => appSettings.language
  })

  registerRepositoryIpcHandlers({
    ipcMain,
    getFocusedWindow: () => BrowserWindow.getFocusedWindow(),
    getWindowFromWebContents: (webContents) => BrowserWindow.fromWebContents(webContents),
    showOpenDialog: (browserWindowOrOptions, options) =>
      options
        ? dialog.showOpenDialog(browserWindowOrOptions as BrowserWindow, options)
        : dialog.showOpenDialog(browserWindowOrOptions),
    loadRepository,
    checkoutBranch,
    openWorktree,
    getPreview,
    getBlame,
    saveFile,
    searchRepository,
    activateRepositoryInWindow
  })

  registerSessionIpcHandlers({
    ipcMain,
    getWindowFromWebContents: (webContents) => BrowserWindow.fromWebContents(webContents),
    getSessionState: () => sessionState,
    setSessionState: (nextSessionState) => {
      sessionState = nextSessionState
    },
    setWindowRepositoryPath: (sourceWindow, repoPath) => {
      windowRepositoryPaths.set(sourceWindow, repoPath)
    },
    writeStoredSession,
    createAppMenu
  })

  registerSettingsIpcHandlers({
    ipcMain,
    readSettings: async () => appSettings,
    writeSettings: (settings) => settingsStore.write(settings),
    applySettings,
    createAppMenu
  })

  createWindow(
    getInitialRepositoryPath({
      envPath: process.env['GITWIKITREE_OPEN_PATH'],
      argv: process.argv,
      isAbsolutePath: isAbsolute,
      isDirectory: (path) => existsSync(path) && statSync(path).isDirectory()
    })
  )

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
