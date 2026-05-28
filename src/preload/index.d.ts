import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  PreviewPayload,
  RecentFileState,
  RepositoryPayload,
  SessionState
} from '../shared/types'

export type GitWikitreeAPI = {
  newWindow: () => Promise<void>
  controlWindow: (action: 'close' | 'minimize' | 'toggle-maximize') => Promise<void>
  pickRepository: () => Promise<RepositoryPayload | undefined>
  loadRepository: (repoPath: string) => Promise<RepositoryPayload>
  loadRef: (repoPath: string, ref: string, rootPath?: string) => Promise<RepositoryPayload>
  openWorktree: (repoPath: string, ref: string) => Promise<RepositoryPayload>
  previewPath: (
    repoPath: string,
    relativePath: string,
    options?: {
      ref?: string
      source?: 'working-tree' | 'git-ref' | 'worktree'
      rootPath?: string
    }
  ) => Promise<PreviewPayload>
  saveFile: (repoPath: string, relativePath: string, content: string) => Promise<PreviewPayload>
  getSession: () => Promise<SessionState>
  saveSession: (session: Partial<SessionState>) => Promise<SessionState>
  onOpenRepositoryPath: (callback: (repoPath: string) => void) => () => void
  onOpenRepositoryRequest: (callback: () => void) => () => void
  onOpenFilePath: (callback: (payload: RecentFileState) => void) => () => void
  onCloseCurrentTabOrWindow: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GitWikitreeAPI
  }
}
