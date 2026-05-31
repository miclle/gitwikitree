import {
  app,
  shell,
  BrowserWindow,
  clipboard,
  ipcMain,
  dialog,
  Menu,
  type ContextMenuParams
} from 'electron'
import { existsSync, statSync } from 'fs'
import { promises as fs } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createAppMenuTemplate, type MenuClickEvent } from './app-menu'
import { createBrowserContextMenuItems } from './browser-context-menu'
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
import type { AppSettings, RecentFileState, RepositoryPayload, SessionState } from '../shared/types'
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

async function isTreeItemContextMenu(params: ContextMenuParams): Promise<boolean> {
  try {
    return (
      (await params.frame?.executeJavaScript(
        `Boolean(document.elementFromPoint(${params.x}, ${params.y})?.closest('[data-tree-item="true"]'))`
      )) === true
    )
  } catch {
    return false
  }
}

async function isMarkdownLinkContextMenu(params: ContextMenuParams): Promise<boolean> {
  try {
    return (
      (await params.frame?.executeJavaScript(
        `(() => {
          const element = document.elementFromPoint(${params.x}, ${params.y})
          if (element?.closest('img')) return false
          return Boolean(element?.closest('a[data-markdown-link="true"]'))
        })()`
      )) === true
    )
  } catch {
    return false
  }
}

async function getContextMenuImageSourceURLs(params: ContextMenuParams): Promise<{
  imageSourceURL?: string
  imageAbsoluteSourceURL?: string
  imageSourceIsPreviewPath?: boolean
}> {
  try {
    const srcURL = JSON.stringify(params.srcURL)
    const sourceURLs = await params.frame?.executeJavaScript(
      `(() => {
        const sourceURL = ${srcURL}
        const imageAtPoint = document.elementFromPoint(${params.x}, ${params.y})?.closest('img')
        const image = imageAtPoint || Array.from(document.images).find((candidate) => {
          return candidate.currentSrc === sourceURL ||
            candidate.src === sourceURL ||
            candidate.getAttribute('src') === sourceURL
        })
        if (!image) return {}
        const previewImageSource = image.getAttribute('data-preview-image-src')
        return {
          imageSourceURL: previewImageSource || image.getAttribute('src') || '',
          imageAbsoluteSourceURL: image.getAttribute('data-preview-image-absolute-src') || '',
          imageSourceIsPreviewPath: previewImageSource !== null
        }
      })()`
    )

    if (!sourceURLs || typeof sourceURLs !== 'object') return {}
    const maybeSourceURLs = sourceURLs as {
      imageSourceURL?: unknown
      imageAbsoluteSourceURL?: unknown
      imageSourceIsPreviewPath?: unknown
    }

    return {
      ...(typeof maybeSourceURLs.imageSourceURL === 'string' &&
      maybeSourceURLs.imageSourceURL.length > 0
        ? { imageSourceURL: maybeSourceURLs.imageSourceURL }
        : {}),
      ...(typeof maybeSourceURLs.imageAbsoluteSourceURL === 'string' &&
      maybeSourceURLs.imageAbsoluteSourceURL.length > 0
        ? { imageAbsoluteSourceURL: maybeSourceURLs.imageAbsoluteSourceURL }
        : {}),
      ...(maybeSourceURLs.imageSourceIsPreviewPath === true
        ? { imageSourceIsPreviewPath: true }
        : {})
    }
  } catch {
    return {}
  }
}

function resolveRepositoryImageAbsolutePath(
  repositoryPath: string | undefined,
  imageSourceURL: string | undefined
): string | undefined {
  if (!repositoryPath || !imageSourceURL) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(imageSourceURL) || imageSourceURL.startsWith('//')) {
    return undefined
  }

  const absolutePath = isAbsolute(imageSourceURL)
    ? resolve(imageSourceURL)
    : resolve(repositoryPath, imageSourceURL)
  const repositoryRelativePath = relative(repositoryPath, absolutePath)

  if (
    repositoryRelativePath === '' ||
    repositoryRelativePath.startsWith('..') ||
    isAbsolute(repositoryRelativePath)
  ) {
    return undefined
  }

  return absolutePath
}

async function showContextMenu(
  targetWindow: BrowserWindow,
  params: ContextMenuParams
): Promise<void> {
  if (await isTreeItemContextMenu(params)) return
  if (await isMarkdownLinkContextMenu(params)) return
  const imageSourceURLs = await getContextMenuImageSourceURLs(params)
  const imageAbsoluteSourceURL =
    imageSourceURLs.imageAbsoluteSourceURL ??
    (imageSourceURLs.imageSourceIsPreviewPath
      ? undefined
      : resolveRepositoryImageAbsolutePath(
          windowRepositoryPaths.get(targetWindow),
          imageSourceURLs.imageSourceURL
        ))

  const items = createBrowserContextMenuItems({
    params,
    language: appSettings.language,
    isDev: is.dev,
    ...imageSourceURLs,
    ...(imageAbsoluteSourceURL ? { imageAbsoluteSourceURL } : {}),
    openExternal: (url) => void shell.openExternal(url),
    writeClipboardText: (text) => clipboard.writeText(text),
    copyImageAt: (x, y) => targetWindow.webContents.copyImageAt(x, y),
    inspectElement: (x, y) => targetWindow.webContents.inspectElement(x, y)
  })

  if (items.length === 0) return
  Menu.buildFromTemplate(items).popup({ window: targetWindow })
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
    void showContextMenu(mainWindow, params)
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
