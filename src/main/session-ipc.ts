import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron'
import { basename } from 'path'
import {
  getProjectSessionState,
  mergeSessionState,
  recordRecentFile,
  recordRecentRepository
} from './session-store'
import type { SessionState } from '../shared/types'

type SessionIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  getWindowFromWebContents: (webContents: IpcMainInvokeEvent['sender']) => BrowserWindow | null
  getSessionState: () => SessionState
  setSessionState: (nextSessionState: SessionState) => void
  setWindowRepositoryPath: (sourceWindow: BrowserWindow, repoPath: string) => void
  writeStoredSession: () => Promise<void>
  createAppMenu: () => void
}

export function registerSessionIpcHandlers({
  ipcMain,
  getWindowFromWebContents,
  getSessionState,
  setSessionState,
  setWindowRepositoryPath,
  writeStoredSession,
  createAppMenu
}: SessionIpcDependencies): void {
  ipcMain.handle('session:get', () => getSessionState())

  ipcMain.handle('session:get-project', (_event, repoPath: string) => {
    return getProjectSessionState(getSessionState(), repoPath)
  })

  ipcMain.handle('session:save', async (event, nextSessionState: Partial<SessionState>) => {
    let sessionState = mergeSessionState(getSessionState(), nextSessionState)
    const sourceWindow = getWindowFromWebContents(event.sender)

    if (sourceWindow && sessionState.repositoryPath) {
      setWindowRepositoryPath(sourceWindow, sessionState.repositoryPath)
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

    setSessionState(sessionState)
    await writeStoredSession()
    createAppMenu()
    return sessionState
  })
}
