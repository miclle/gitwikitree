import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  type OpenDialogOptions,
  type MenuItemConstructorOptions
} from 'electron'
import { existsSync, statSync } from 'fs'
import { promises as fs } from 'fs'
import { basename, isAbsolute, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import {
  clearRecentFiles,
  createEmptySessionState,
  findRepositoryWindowIndex,
  getRecentFileOpenPayload,
  getRecentRepositories,
  mergeSessionState,
  normalizeSessionState,
  recordRecentRepository,
  recordRecentFile
} from './session-store'
import { getPreview, loadRepository, openWorktree, saveFile } from './repository-service'
import type {
  RecentFileState,
  RecentRepositoryState,
  RepositoryPayload,
  SessionState
} from '../shared/types'

const appName = 'Git Wikitree'

app.setName(appName)

const windows = new Set<BrowserWindow>()
const windowRepositoryPaths = new Map<BrowserWindow, string>()
let sessionState = createEmptySessionState()

function getInitialRepositoryPath(): string | undefined {
  const envPath = process.env['GITWIKITREE_OPEN_PATH']
  if (envPath) return envPath

  return process.argv.slice(1).find((argument) => {
    if (!isAbsolute(argument) || !existsSync(argument)) return false

    try {
      return statSync(argument).isDirectory()
    } catch {
      return false
    }
  })
}

function getSessionFilePath(): string {
  return join(app.getPath('userData'), 'session.json')
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

function sendOpenFile(targetWindow: BrowserWindow, file: RecentFileState): void {
  targetWindow.webContents.send('repository:open-file', getRecentFileOpenPayload(file))
}

function closeFocusedFileTabOrWindow(): void {
  const targetWindow = BrowserWindow.getFocusedWindow()
  if (!targetWindow) return

  targetWindow.webContents.send('tab:close-current-or-window')
}

function createWindow(repoPath?: string, file?: RecentFileState): void {
  const mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
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

  mainWindow.on('closed', () => {
    windows.delete(mainWindow)
    windowRepositoryPaths.delete(mainWindow)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.once('did-finish-load', () => {
    if (file) {
      sendOpenFile(mainWindow, file)
    } else if (repoPath) {
      mainWindow.webContents.send('repository:open-path', repoPath)
    }
  })
}

function openRecentFile(file: RecentFileState): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  if (targetWindow) {
    sendOpenFile(targetWindow, file)
    return
  }

  createWindow(file.repoPath, file)
}

function openRecentRepository(repoPath: string): void {
  const openWindows = BrowserWindow.getAllWindows()
  const windowIndex = findRepositoryWindowIndex(
    repoPath,
    openWindows.map((window) => windowRepositoryPaths.get(window))
  )
  const repositoryWindow = windowIndex >= 0 ? openWindows[windowIndex] : undefined

  if (repositoryWindow) {
    if (repositoryWindow.isMinimized()) repositoryWindow.restore()
    repositoryWindow.show()
    repositoryWindow.focus()
    return
  }

  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  if (targetWindow) {
    targetWindow.webContents.send('repository:open-path', repoPath)
    return
  }

  createWindow(repoPath)
}

async function clearRecentMenuItems(): Promise<void> {
  sessionState = clearRecentFiles(sessionState)
  await writeStoredSession()
  createAppMenu()
}

function getRecentRepositoryState(repository: RepositoryPayload): RecentRepositoryState {
  return {
    repoPath: repository.path,
    rootPath: repository.rootPath,
    name: basename(repository.path),
    openedAt: new Date().toISOString(),
    activeRef: repository.activeRef,
    source: repository.source
  }
}

function recordLoadedRepository(repository: RepositoryPayload): void {
  sessionState = {
    ...sessionState,
    recentRepositories: recordRecentRepository(
      sessionState.recentRepositories,
      getRecentRepositoryState(repository)
    )
  }
}

function createAppMenu(): void {
  const recentRepositoryItems: MenuItemConstructorOptions[] =
    sessionState.recentRepositories.length > 0 || sessionState.recentFiles.length > 0
      ? getRecentRepositories(sessionState.recentRepositories, sessionState.recentFiles).map(
          (repoPath) => ({
            label: `${basename(repoPath)} - ${repoPath}`,
            click: () => openRecentRepository(repoPath)
          })
        )
      : [{ label: 'No Recent Projects', enabled: false }]

  const recentFileItems: MenuItemConstructorOptions[] =
    sessionState.recentFiles.length > 0
      ? sessionState.recentFiles.map((file) => ({
          label: `${file.name} - ${file.repoPath}`,
          click: () => openRecentFile(file)
        }))
      : [{ label: 'No Recent Files', enabled: false }]

  const recentItems: MenuItemConstructorOptions[] = [
    { label: '最近打开的项目', enabled: false },
    ...recentRepositoryItems,
    { type: 'separator' },
    { label: '最近打开的文件', enabled: false },
    ...recentFileItems,
    { type: 'separator' },
    {
      label: '清除最近打开...',
      enabled: sessionState.recentRepositories.length > 0 || sessionState.recentFiles.length > 0,
      click: () => {
        void clearRecentMenuItems()
      }
    }
  ]

  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin'
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CommandOrControl+N',
          click: () => createWindow()
        },
        {
          label: 'Open Repository...',
          accelerator: 'CommandOrControl+O',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('repository:open-request')
        },
        {
          label: '最近打开的文件',
          submenu: recentItems
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CommandOrControl+W',
          click: closeFocusedFileTabOrWindow
        },
        {
          label: 'Close Window',
          accelerator: 'Shift+CommandOrControl+W',
          click: () => BrowserWindow.getFocusedWindow()?.close()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
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

  ipcMain.handle('window:new', () => createWindow())

  ipcMain.handle('window:control', (event, action: 'close' | 'minimize' | 'toggle-maximize') => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender)
    if (!browserWindow) return

    if (action === 'close') {
      browserWindow.close()
      return
    }

    if (action === 'minimize') {
      browserWindow.minimize()
      return
    }

    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize()
    } else {
      browserWindow.maximize()
    }
  })

  ipcMain.handle('repository:pick', async () => {
    const browserWindow = BrowserWindow.getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Open Git Repository',
      properties: ['openDirectory']
    }
    const result = browserWindow
      ? await dialog.showOpenDialog(browserWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return undefined
    const repository = await loadRepository(result.filePaths[0])
    const sourceWindow = browserWindow ?? BrowserWindow.getFocusedWindow()
    if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
    recordLoadedRepository(repository)
    sessionState = mergeSessionState(sessionState, {
      repositoryPath: repository.path,
      rootPath: repository.rootPath,
      activeRef: repository.activeRef,
      source: repository.source,
      selectedPath: '',
      activeFilePath: undefined,
      openFileTabs: [],
      expandedPaths: ['']
    })
    await writeStoredSession()
    return repository
  })

  ipcMain.handle('repository:load', async (_event, repoPath: string) => {
    const repository = await loadRepository(repoPath)
    const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
    if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
    recordLoadedRepository(repository)
    sessionState = mergeSessionState(sessionState, {
      repositoryPath: repository.path,
      rootPath: repository.rootPath,
      activeRef: repository.activeRef,
      source: repository.source
    })
    await writeStoredSession()
    return repository
  })

  ipcMain.handle(
    'repository:load-ref',
    async (_event, repoPath: string, ref: string, rootPath?: string) => {
      const repository = await loadRepository(repoPath, { ref, source: 'git-ref', rootPath })
      const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
      if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
      recordLoadedRepository(repository)
      sessionState = mergeSessionState(sessionState, {
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath: '',
        activeFilePath: undefined,
        openFileTabs: [],
        expandedPaths: ['']
      })
      await writeStoredSession()
      return repository
    }
  )

  ipcMain.handle('repository:open-worktree', async (_event, repoPath: string, ref: string) => {
    const repository = await openWorktree(repoPath, ref)
    const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
    if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
    recordLoadedRepository(repository)
    sessionState = mergeSessionState(sessionState, {
      repositoryPath: repository.path,
      rootPath: repository.rootPath,
      activeRef: repository.activeRef,
      source: repository.source,
      selectedPath: '',
      activeFilePath: undefined,
      openFileTabs: [],
      expandedPaths: ['']
    })
    await writeStoredSession()
    return repository
  })

  ipcMain.handle('session:get', () => sessionState)

  ipcMain.handle('session:save', async (_event, nextSessionState: Partial<SessionState>) => {
    sessionState = mergeSessionState(sessionState, nextSessionState)
    const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
    if (sourceWindow && sessionState.repositoryPath) {
      windowRepositoryPaths.set(sourceWindow, sessionState.repositoryPath)
    }
    if (sessionState.repositoryPath) {
      sessionState = {
        ...sessionState,
        recentRepositories: recordRecentRepository(sessionState.recentRepositories, {
          repoPath: sessionState.repositoryPath,
          rootPath: sessionState.rootPath,
          name: basename(sessionState.repositoryPath),
          openedAt: new Date().toISOString(),
          activeRef: sessionState.activeRef,
          source: sessionState.source
        })
      }
    }
    const activeFilePath = sessionState.activeFilePath

    if (sessionState.repositoryPath && activeFilePath) {
      sessionState = {
        ...sessionState,
        recentFiles: recordRecentFile(sessionState.recentFiles, {
          repoPath: sessionState.repositoryPath,
          rootPath: sessionState.rootPath,
          filePath: activeFilePath,
          name: basename(activeFilePath),
          openedAt: new Date().toISOString(),
          activeRef: sessionState.activeRef,
          source: sessionState.source
        })
      }
    }

    await writeStoredSession()
    createAppMenu()
    return sessionState
  })

  ipcMain.handle(
    'repository:preview',
    async (
      _event,
      repoPath: string,
      relativePath = '',
      options?: {
        ref?: string
        source?: 'working-tree' | 'git-ref' | 'worktree'
        rootPath?: string
      }
    ) => {
      return getPreview(repoPath, relativePath, options)
    }
  )

  ipcMain.handle(
    'repository:save-file',
    async (_event, repoPath: string, relativePath: string, content: string) => {
      return saveFile(repoPath, relativePath, content)
    }
  )

  createWindow(getInitialRepositoryPath())

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
