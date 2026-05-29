import type { BrowserWindow, OpenDialogOptions } from 'electron'
import type { RepositoryPayload } from '../shared/types'

type OpenDialogResult = {
  canceled: boolean
  filePaths: string[]
}

type OpenRepositoryDialogDependencies = {
  getFocusedWindow: () => BrowserWindow | undefined | null
  showOpenDialog: (
    browserWindowOrOptions: BrowserWindow | OpenDialogOptions,
    options?: OpenDialogOptions
  ) => Promise<OpenDialogResult>
  loadRepository: (repoPath: string) => Promise<RepositoryPayload>
  createWindow: (repoPath: string) => void
  showErrorBox: (title: string, content: string) => void
}

export async function openRepositoryInNewWindow({
  getFocusedWindow,
  showOpenDialog,
  loadRepository,
  createWindow,
  showErrorBox
}: OpenRepositoryDialogDependencies): Promise<void> {
  const browserWindow = getFocusedWindow()
  const options: OpenDialogOptions = {
    title: 'Open Git Repository',
    properties: ['openDirectory']
  }
  const result = browserWindow
    ? await showOpenDialog(browserWindow, options)
    : await showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return

  try {
    const repository = await loadRepository(result.filePaths[0])
    createWindow(repository.path)
  } catch (reason) {
    showErrorBox(
      'Open Repository Failed',
      reason instanceof Error ? reason.message : String(reason)
    )
  }
}
