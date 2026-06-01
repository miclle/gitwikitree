import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  FileTabShortcutPosition,
  GitBlamePayload,
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  PreviewPayload,
  ProjectSessionState,
  RecentFileState,
  RepositoryLoadOptions,
  RepositoryPayload,
  RepositorySearchResult,
  SaveFileOptions,
  SessionState,
  TreeItemOpenPayload
} from '../shared/types'

export type GitWikitreeAPI = {
  newWindow: () => Promise<void>
  controlWindow: (action: 'close' | 'minimize' | 'toggle-maximize') => Promise<void>
  showTreeItemContextMenu: (item: TreeItemOpenPayload) => Promise<void>
  showMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  pickRepository: () => Promise<RepositoryPayload | undefined>
  loadRepository: (repoPath: string) => Promise<RepositoryPayload>
  checkoutBranch: (repoPath: string, branch: string) => Promise<RepositoryPayload>
  openWorktree: (repoPath: string, ref: string) => Promise<RepositoryPayload>
  previewPath: (
    repoPath: string,
    relativePath: string,
    options?: {
      source?: 'working-tree' | 'worktree'
      rootPath?: string
    }
  ) => Promise<PreviewPayload>
  getBlame: (
    repoPath: string,
    relativePath: string,
    options?: RepositoryLoadOptions
  ) => Promise<GitBlamePayload>
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
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  getSession: () => Promise<SessionState>
  getProjectSession: (repoPath: string) => Promise<ProjectSessionState | undefined>
  saveSession: (session: Partial<SessionState>) => Promise<SessionState>
  onOpenRepositoryPath: (callback: (repoPath: string) => void) => () => void
  onOpenRepositoryRequest: (callback: () => void) => () => void
  onOpenFilePath: (callback: (payload: RecentFileState) => void) => () => void
  onOpenTreeItem: (callback: (payload: TreeItemOpenPayload) => void) => () => void
  onOpenTreeItemInNewTab: (callback: (path: string) => void) => () => void
  onOpenMarkdownLink: (callback: (payload: MarkdownLinkOpenPayload) => void) => () => void
  onCloseCurrentTabOrWindow: (callback: () => void) => () => void
  onSelectFileTabByShortcut: (callback: (position: FileTabShortcutPosition) => void) => () => void
  onOpenCurrentTabSearch: (callback: () => void) => () => void
  onOpenGlobalSearch: (callback: () => void) => () => void
  onSaveCurrentFile: (callback: () => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GitWikitreeAPI
  }
}
