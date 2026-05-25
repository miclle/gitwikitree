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
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { promisify } from 'util'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const appName = 'Git Wikitree'
const execFileAsync = promisify(execFile)
const maxTextPreviewBytes = 1024 * 1024

type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

type RepositoryPayload = {
  name: string
  path: string
  branch: string
  tree: TreeNode[]
}

type PreviewPayload =
  | {
      kind: 'directory'
      path: string
      readme?: { path: string; content: string }
      entries?: Array<{ name: string; path: string; type: 'file' | 'directory' }>
    }
  | {
      kind: 'file'
      path: string
      name: string
      extension: string
      previewType: 'markdown' | 'html' | 'svg' | 'image' | 'text' | 'unsupported'
      content?: string
      dataUrl?: string
      size: number
    }

app.setName(appName)

const windows = new Set<BrowserWindow>()

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

function isPathInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function assertRepositoryPath(repoPath: string): Promise<string> {
  const resolved = resolve(repoPath)
  const stats = await fs.stat(resolved)

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.')
  }

  await execFileAsync('git', ['-C', resolved, 'rev-parse', '--show-toplevel'])
  return resolved
}

async function getBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'branch', '--show-current'])
    return stdout.trim() || 'HEAD'
  } catch {
    return 'HEAD'
  }
}

async function getGitVisibleFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'ls-files',
    '-co',
    '--exclude-standard'
  ])

  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function insertPath(tree: TreeNode[], filePath: string): void {
  const parts = filePath.split('/').filter(Boolean)
  let siblings = tree
  let currentPath = ''

  parts.forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const type = index === parts.length - 1 ? 'file' : 'directory'
    let node = siblings.find((item) => item.name === part)

    if (!node) {
      node = {
        name: part,
        path: currentPath,
        type,
        ...(type === 'directory' ? { children: [] } : {})
      }
      siblings.push(node)
      siblings.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
    }

    if (node.type === 'directory') {
      siblings = node.children ?? []
    }
  })
}

async function loadRepository(repoPath: string): Promise<RepositoryPayload> {
  const resolvedPath = await assertRepositoryPath(repoPath)
  const [branch, files] = await Promise.all([
    getBranch(resolvedPath),
    getGitVisibleFiles(resolvedPath)
  ])
  const tree: TreeNode[] = []

  files.forEach((file) => insertPath(tree, file))

  return {
    name: basename(resolvedPath),
    path: resolvedPath,
    branch,
    tree
  }
}

function safeJoin(repoPath: string, relativePath = ''): string {
  const target = resolve(repoPath, relativePath)

  if (!isPathInside(repoPath, target)) {
    throw new Error('Path is outside the selected repository.')
  }

  return target
}

function getNodeAtPath(tree: TreeNode[], path: string): TreeNode | undefined {
  if (!path) return undefined

  const parts = path.split('/').filter(Boolean)
  let siblings = tree
  let node: TreeNode | undefined

  for (const part of parts) {
    node = siblings.find((item) => item.name === part)
    if (!node) return undefined
    siblings = node.children ?? []
  }

  return node
}

function findReadme(children: TreeNode[] = []): TreeNode | undefined {
  return children.find((entry) => {
    const lowerName = entry.name.toLowerCase()
    return entry.type === 'file' && (lowerName === 'readme.md' || lowerName === 'readme.markdown')
  })
}

function mimeForExtension(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

function getPreviewType(
  extension: string
): 'markdown' | 'html' | 'svg' | 'image' | 'text' | 'unsupported' {
  if (['.md', '.markdown'].includes(extension)) return 'markdown'
  if (['.html', '.htm'].includes(extension)) return 'html'
  if (extension === '.svg') return 'svg'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'].includes(extension)) return 'image'
  if (
    [
      '.txt',
      '.json',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.yml',
      '.yaml',
      '.xml',
      '.toml',
      '.ini',
      '.env',
      '.gitignore',
      '.dockerignore',
      '.sh',
      '.zsh',
      '.bash',
      '.py',
      '.rb',
      '.go',
      '.rs',
      '.swift',
      '.java',
      '.c',
      '.h',
      '.cpp',
      '.hpp',
      '.m',
      '.mm',
      '.sql',
      '.csv',
      '.log',
      ''
    ].includes(extension)
  ) {
    return 'text'
  }

  return 'unsupported'
}

async function getPreview(repoPath: string, relativePath = ''): Promise<PreviewPayload> {
  const repository = await loadRepository(repoPath)
  const node = relativePath ? getNodeAtPath(repository.tree, relativePath) : undefined
  const target = safeJoin(repository.path, relativePath)
  const stats = await fs.stat(target)

  if (stats.isDirectory()) {
    const children = relativePath ? (node?.children ?? []) : repository.tree
    const readme = findReadme(children)

    if (readme) {
      const content = await fs.readFile(safeJoin(repository.path, readme.path), 'utf8')
      return {
        kind: 'directory',
        path: toPosixPath(relativePath),
        readme: {
          path: readme.path,
          content
        }
      }
    }

    return {
      kind: 'directory',
      path: toPosixPath(relativePath),
      entries: children.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type
      }))
    }
  }

  const extension = extname(target).toLowerCase()
  const previewType = getPreviewType(extension)
  const payload = {
    kind: 'file' as const,
    path: toPosixPath(relativePath),
    name: basename(target),
    extension,
    previewType,
    size: stats.size
  }

  if (previewType === 'image') {
    const buffer = await fs.readFile(target)
    return {
      ...payload,
      dataUrl: `data:${mimeForExtension(extension)};base64,${buffer.toString('base64')}`
    }
  }

  if (previewType === 'svg') {
    return {
      ...payload,
      content: await fs.readFile(target, 'utf8')
    }
  }

  if (previewType !== 'unsupported' && stats.size <= maxTextPreviewBytes) {
    return {
      ...payload,
      content: await fs.readFile(target, 'utf8')
    }
  }

  return payload
}

function createWindow(repoPath?: string): void {
  const mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: appName,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  windows.add(mainWindow)

  mainWindow.on('closed', () => {
    windows.delete(mainWindow)
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
    if (repoPath) {
      mainWindow.webContents.send('repository:open-path', repoPath)
    }
  })
}

function createAppMenu(): void {
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
        { type: 'separator' },
        { role: process.platform === 'darwin' ? 'close' : 'quit' }
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
app.whenReady().then(() => {
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
    return loadRepository(result.filePaths[0])
  })

  ipcMain.handle('repository:load', async (_event, repoPath: string) => {
    return loadRepository(repoPath)
  })

  ipcMain.handle('repository:preview', async (_event, repoPath: string, relativePath = '') => {
    return getPreview(repoPath, relativePath)
  })

  createWindow()

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
