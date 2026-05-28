import { ElectronAPI } from '@electron-toolkit/preload'

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

export type RepositoryPayload = {
  name: string
  path: string
  rootPath: string
  branch: string
  activeRef: string
  source: 'working-tree' | 'git-ref' | 'worktree'
  editable: boolean
  refs: Array<{ name: string; type: 'local' | 'remote'; current: boolean }>
  tree: TreeNode[]
}

export type DirectoryPreview = {
  kind: 'directory'
  path: string
  readme?: { path: string; content: string }
  entries?: Array<{ name: string; path: string; type: 'file' | 'directory' }>
}

export type FilePreview = {
  kind: 'file'
  path: string
  name: string
  extension: string
  previewType: 'markdown' | 'html' | 'svg' | 'image' | 'text' | 'unsupported'
  editable: boolean
  content?: string
  dataUrl?: string
  size: number
}

export type PreviewPayload = DirectoryPreview | FilePreview

export type OpenFileTabState = {
  path: string
  name: string
}

export type RecentFileState = {
  repoPath: string
  filePath: string
  name: string
  openedAt: string
}

export type SessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
  selectedPath: string
  activeFilePath?: string
  openFileTabs: OpenFileTabState[]
  expandedPaths: string[]
  recentFiles: RecentFileState[]
}

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
  onOpenFilePath: (
    callback: (payload: { repoPath: string; filePath: string }) => void
  ) => () => void
  onCloseCurrentTabOrWindow: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GitWikitreeAPI
  }
}
