import type { BrowserWindow, IpcMain, IpcMainInvokeEvent, OpenDialogOptions } from 'electron'
import type {
  PreviewPayload,
  RepositoryPayload,
  RepositorySearchResult,
  SaveFileOptions
} from '../shared/types'
import type { RepositoryLoadOptions } from '../shared/types'

type OpenDialogResult = {
  canceled: boolean
  filePaths: string[]
}

type RepositoryIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  getFocusedWindow: () => BrowserWindow | null
  getWindowFromWebContents: (webContents: IpcMainInvokeEvent['sender']) => BrowserWindow | null
  showOpenDialog: (
    browserWindowOrOptions: BrowserWindow | OpenDialogOptions,
    options?: OpenDialogOptions
  ) => Promise<OpenDialogResult>
  loadRepository: (repoPath: string, options?: RepositoryLoadOptions) => Promise<RepositoryPayload>
  checkoutBranch: (repoPath: string, branch: string) => Promise<RepositoryPayload>
  openWorktree: (repoPath: string, ref: string) => Promise<RepositoryPayload>
  getPreview: (
    repoPath: string,
    relativePath?: string,
    options?: RepositoryLoadOptions
  ) => Promise<PreviewPayload>
  saveFile: (
    repoPath: string,
    relativePath: string,
    content: string,
    options?: SaveFileOptions
  ) => Promise<PreviewPayload>
  searchRepository: (
    repoPath: string,
    query: string,
    options?: RepositoryLoadOptions
  ) => Promise<RepositorySearchResult[]>
  activateRepositoryInWindow: (
    sourceWindow: BrowserWindow | null | undefined,
    repository: RepositoryPayload
  ) => Promise<void>
}

export function registerRepositoryIpcHandlers({
  ipcMain,
  getFocusedWindow,
  getWindowFromWebContents,
  showOpenDialog,
  loadRepository,
  checkoutBranch,
  openWorktree,
  getPreview,
  saveFile,
  searchRepository,
  activateRepositoryInWindow
}: RepositoryIpcDependencies): void {
  ipcMain.handle('repository:pick', async () => {
    const browserWindow = getFocusedWindow()
    const options: OpenDialogOptions = {
      title: 'Open Git Repository',
      properties: ['openDirectory']
    }
    const result = browserWindow
      ? await showOpenDialog(browserWindow, options)
      : await showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return undefined
    const repository = await loadRepository(result.filePaths[0])
    const sourceWindow = browserWindow ?? getFocusedWindow()
    await activateRepositoryInWindow(sourceWindow, repository)
    return repository
  })

  ipcMain.handle('repository:load', async (event, repoPath: string) => {
    const repository = await loadRepository(repoPath)
    const sourceWindow = getWindowFromWebContents(event.sender)
    await activateRepositoryInWindow(sourceWindow, repository)
    return repository
  })

  ipcMain.handle('repository:checkout-branch', async (event, repoPath: string, branch: string) => {
    const repository = await checkoutBranch(repoPath, branch)
    const sourceWindow = getWindowFromWebContents(event.sender)
    await activateRepositoryInWindow(sourceWindow, repository)
    return repository
  })

  ipcMain.handle('repository:open-worktree', async (event, repoPath: string, ref: string) => {
    const repository = await openWorktree(repoPath, ref)
    const sourceWindow = getWindowFromWebContents(event.sender)
    await activateRepositoryInWindow(sourceWindow, repository)
    return repository
  })

  ipcMain.handle(
    'repository:preview',
    async (_event, repoPath: string, relativePath = '', options?: RepositoryLoadOptions) => {
      return getPreview(repoPath, relativePath, options)
    }
  )

  ipcMain.handle(
    'repository:save-file',
    async (
      _event,
      repoPath: string,
      relativePath: string,
      content: string,
      options?: SaveFileOptions
    ) => {
      return saveFile(repoPath, relativePath, content, options)
    }
  )

  ipcMain.handle(
    'repository:search',
    async (_event, repoPath: string, query: string, options?: RepositoryLoadOptions) => {
      return searchRepository(repoPath, query, options)
    }
  )
}
