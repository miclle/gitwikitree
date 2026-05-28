import {
  app,
  shell,
  BrowserWindow,
  clipboard,
  ipcMain,
  dialog,
  Menu,
  type ContextMenuParams,
  type OpenDialogOptions,
  type MenuItemConstructorOptions
} from 'electron'
import { existsSync, statSync } from 'fs'
import { promises as fs } from 'fs'
import { basename, isAbsolute, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createTreeItemContextMenuItems, type TreeItemContext } from './context-menu'
import {
  clearRecentFiles,
  createEmptySessionState,
  findRepositoryWindowIndex,
  getProjectSessionState,
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
  SessionState,
  WindowState
} from '../shared/types'

const appName = 'Git Wikitree'
type MenuClickEvent = Parameters<NonNullable<MenuItemConstructorOptions['click']>>[2]

app.setName(appName)

const windows = new Set<BrowserWindow>()
const windowRepositoryPaths = new Map<BrowserWindow, string>()
const windowStateSaveTimers = new Map<BrowserWindow, ReturnType<typeof setTimeout>>()
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

function getSavedWindowState(repoPath?: string): WindowState | undefined {
  return repoPath
    ? getProjectSessionState(sessionState, repoPath)?.windowState
    : sessionState.windowState
}

function getBrowserWindowBounds(repoPath?: string): Partial<WindowState> {
  const windowState = getSavedWindowState(repoPath)
  if (!windowState) return {}

  return {
    ...(typeof windowState.x === 'number' ? { x: windowState.x } : {}),
    ...(typeof windowState.y === 'number' ? { y: windowState.y } : {}),
    width: windowState.width,
    height: windowState.height
  }
}

function readWindowState(browserWindow: BrowserWindow): WindowState {
  const bounds = browserWindow.isMaximized()
    ? browserWindow.getNormalBounds()
    : browserWindow.getBounds()

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: browserWindow.isMaximized()
  }
}

async function saveWindowState(browserWindow: BrowserWindow): Promise<void> {
  if (browserWindow.isDestroyed()) return

  const repoPath = windowRepositoryPaths.get(browserWindow)
  const windowState = readWindowState(browserWindow)

  if (!repoPath) {
    await writeStoredSession({ ...sessionState, windowState })
    return
  }

  sessionState = mergeSessionState(sessionState, {
    projectSessions: {
      [repoPath]: {
        repositoryPath: repoPath,
        selectedPath: '',
        openFileTabs: [],
        expandedPaths: [''],
        ...getProjectSessionState(sessionState, repoPath),
        windowState
      }
    }
  })
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

function canOpenExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
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

async function showContextMenu(
  targetWindow: BrowserWindow,
  params: ContextMenuParams
): Promise<void> {
  if (await isTreeItemContextMenu(params)) return

  const items: MenuItemConstructorOptions[] = []
  const addSeparator = (): void => {
    if (items.length > 0 && items.at(-1)?.type !== 'separator') {
      items.push({ type: 'separator' })
    }
  }
  const addEditItems = (editItems: MenuItemConstructorOptions[]): void => {
    for (const item of editItems) items.push(item)
  }

  if (params.linkURL) {
    addEditItems([
      {
        label: 'Open Link',
        enabled: canOpenExternalUrl(params.linkURL),
        click: () => void shell.openExternal(params.linkURL)
      },
      {
        label: 'Copy Link Address',
        click: () => clipboard.writeText(params.linkURL)
      }
    ])
    addSeparator()
  }

  if (params.mediaType === 'image' && params.hasImageContents) {
    items.push({
      label: 'Copy Image',
      click: () => targetWindow.webContents.copyImageAt(params.x, params.y)
    })

    if (params.srcURL) {
      items.push({
        label: 'Copy Image Address',
        click: () => clipboard.writeText(params.srcURL)
      })
    }

    addSeparator()
  }

  if (params.isEditable) {
    addEditItems([
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'pasteAndMatchStyle', enabled: params.editFlags.canPaste },
      { role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ])
  } else {
    addEditItems([
      { role: 'copy', enabled: params.editFlags.canCopy || params.selectionText.length > 0 },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ])
  }

  if (is.dev) {
    addSeparator()
    items.push({
      label: 'Inspect Element',
      click: () => targetWindow.webContents.inspectElement(params.x, params.y)
    })
  }

  while (items.at(-1)?.type === 'separator') items.pop()

  if (items.length === 0) return
  Menu.buildFromTemplate(items).popup({ window: targetWindow })
}

function createWindow(repoPath?: string, file?: RecentFileState, treeItem?: TreeItemContext): void {
  const savedWindowState = getSavedWindowState(repoPath)
  const mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    ...getBrowserWindowBounds(repoPath),
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

async function openRepositoryInNewWindow(): Promise<void> {
  const browserWindow = BrowserWindow.getFocusedWindow()
  const options: OpenDialogOptions = {
    title: 'Open Git Repository',
    properties: ['openDirectory']
  }
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return

  try {
    const repository = await loadRepository(result.filePaths[0])
    createWindow(repository.path)
  } catch (reason) {
    dialog.showErrorBox(
      'Open Repository Failed',
      reason instanceof Error ? reason.message : String(reason)
    )
  }
}

function openRecentFile(file: RecentFileState): void {
  const targetWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  if (targetWindow) {
    sendOpenFile(targetWindow, file)
    return
  }

  createWindow(file.repoPath, file)
}

function shouldOpenInNewWindow(event: MenuClickEvent): boolean {
  return Boolean(event.metaKey || event.altKey)
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

function openRecentRepositoryMenuItem(repoPath: string, event: MenuClickEvent): void {
  if (shouldOpenInNewWindow(event)) {
    createWindow(repoPath)
    return
  }

  openRecentRepository(repoPath)
}

function openRecentFileMenuItem(file: RecentFileState, event: MenuClickEvent): void {
  if (shouldOpenInNewWindow(event)) {
    createWindow(file.repoPath, file)
    return
  }

  openRecentFile(file)
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
            click: (_menuItem, _window, event) => openRecentRepositoryMenuItem(repoPath, event)
          })
        )
      : [{ label: 'No Recent Projects', enabled: false }]

  const recentFileItems: MenuItemConstructorOptions[] =
    sessionState.recentFiles.length > 0
      ? sessionState.recentFiles.map((file) => ({
          label: `${file.name} - ${file.repoPath}`,
          click: (_menuItem, _window, event) => openRecentFileMenuItem(file, event)
        }))
      : [{ label: 'No Recent Files', enabled: false }]

  const recentItems: MenuItemConstructorOptions[] = [
    { label: '最近打开的项目', enabled: false },
    ...recentRepositoryItems,
    { type: 'separator' },
    { label: 'Recent Files', enabled: false },
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
          label: 'Open Repository...',
          accelerator: 'CommandOrControl+O',
          click: () => {
            void openRepositoryInNewWindow()
          }
        },
        {
          label: 'Recent Files',
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

  ipcMain.handle('context-menu:tree-item', (event, item: TreeItemContext) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender)
    if (!targetWindow) return

    const menuItems = createTreeItemContextMenuItems({
      item,
      sender: event.sender,
      openInNewWindow: (targetItem) => createWindow(undefined, undefined, targetItem)
    })

    Menu.buildFromTemplate(menuItems).popup({ window: targetWindow })
  })

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
    sessionState = mergeSessionState(
      sessionState,
      {
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath: '',
        activeFilePath: undefined,
        openFileTabs: [],
        expandedPaths: ['']
      },
      { syncProjectSession: false }
    )
    await writeStoredSession()
    return repository
  })

  ipcMain.handle('repository:load', async (_event, repoPath: string) => {
    const repository = await loadRepository(repoPath)
    const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
    if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
    recordLoadedRepository(repository)
    sessionState = mergeSessionState(
      sessionState,
      {
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath: '',
        activeFilePath: undefined,
        activeFileTabId: undefined,
        openFileTabs: [],
        expandedPaths: ['']
      },
      { syncProjectSession: false }
    )
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
      sessionState = mergeSessionState(
        sessionState,
        {
          repositoryPath: repository.path,
          rootPath: repository.rootPath,
          activeRef: repository.activeRef,
          source: repository.source,
          selectedPath: '',
          activeFilePath: undefined,
          openFileTabs: [],
          expandedPaths: ['']
        },
        { syncProjectSession: false }
      )
      await writeStoredSession()
      return repository
    }
  )

  ipcMain.handle('repository:open-worktree', async (_event, repoPath: string, ref: string) => {
    const repository = await openWorktree(repoPath, ref)
    const sourceWindow = BrowserWindow.fromWebContents(_event.sender)
    if (sourceWindow) windowRepositoryPaths.set(sourceWindow, repository.path)
    recordLoadedRepository(repository)
    sessionState = mergeSessionState(
      sessionState,
      {
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath: '',
        activeFilePath: undefined,
        openFileTabs: [],
        expandedPaths: ['']
      },
      { syncProjectSession: false }
    )
    await writeStoredSession()
    return repository
  })

  ipcMain.handle('session:get', () => sessionState)

  ipcMain.handle('session:get-project', (_event, repoPath: string) => {
    return getProjectSessionState(sessionState, repoPath)
  })

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
