export type RepositorySource = 'working-tree' | 'worktree'

export type PreviewType = 'markdown' | 'html' | 'svg' | 'image' | 'pdf' | 'text' | 'unsupported'

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  gitStatus?: 'modified'
  children?: TreeNode[]
  index?: { name: string; path: string }
}

export type TreeItemOpenPayload = Pick<TreeNode, 'name' | 'path' | 'type'> & {
  repoPath: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
  anchor?: string
}

export type MarkdownLinkKind = 'external' | 'internal' | 'anchor' | 'unresolved'

export type MarkdownLinkContext = {
  kind: MarkdownLinkKind
  href: string
  targetPath?: string
  targetName?: string
  targetType?: 'file' | 'directory'
  hash?: string
  repoPath?: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
}

export type MarkdownLinkOpenAction = 'open' | 'open-new-tab'

export type MarkdownLinkOpenPayload = MarkdownLinkContext & {
  action: MarkdownLinkOpenAction
}

export type RepositoryRef = {
  name: string
  type: 'local' | 'remote'
  current: boolean
  worktreePath?: string
}

export type RepositoryPayload = {
  name: string
  path: string
  rootPath: string
  branch: string
  activeRef: string
  source: RepositorySource
  editable: boolean
  refs: RepositoryRef[]
  tree: TreeNode[]
  index?: { name: string; path: string }
}

export type RepositorySearchResult = {
  path: string
  name: string
  type: 'file' | 'directory'
  matchType: 'path' | 'content'
  snippet?: string
  lineNumber?: number
}

export type DirectoryPreview = {
  kind: 'directory'
  path: string
  modifiedAt: string
  readme?: {
    path: string
    content: string
    markdownAssetDataUrls?: Record<string, string>
    markdownAssetPaths?: Record<string, string>
    markdownAssetAbsolutePaths?: Record<string, string>
  }
  entries?: Array<{ name: string; path: string; type: 'file' | 'directory' }>
}

export type FilePreview = {
  kind: 'file'
  path: string
  name: string
  extension: string
  previewType: PreviewType
  editable: boolean
  content?: string
  dataUrl?: string
  markdownAssetDataUrls?: Record<string, string>
  markdownAssetPaths?: Record<string, string>
  markdownAssetAbsolutePaths?: Record<string, string>
  size: number
  modifiedAt: string
}

export type PreviewPayload = DirectoryPreview | FilePreview

export type NavigationTarget = {
  path: string
  name: string
  type?: 'file' | 'directory'
}

export type OpenFileTabState = NavigationTarget & {
  id?: string
  history?: NavigationTarget[]
  historyIndex?: number
}

export type RecentFileState = {
  repoPath: string
  rootPath?: string
  filePath: string
  name: string
  openedAt: string
  activeRef?: string
  source?: RepositorySource
}

export type RecentRepositoryState = {
  repoPath: string
  rootPath?: string
  name: string
  openedAt: string
  activeRef?: string
  source?: RepositorySource
}

export type WindowState = {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

export type ProjectSessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
  selectedPath: string
  activeFilePath?: string
  activeFileTabId?: string
  openFileTabs: OpenFileTabState[]
  expandedPaths: string[]
  sidebarWidth?: number
  isSidebarOpen?: boolean
  windowState?: WindowState
}

export type SessionState = ProjectSessionState & {
  projectSessions: Record<string, ProjectSessionState>
  recentRepositories: RecentRepositoryState[]
  recentFiles: RecentFileState[]
}

export type RepositoryLoadOptions = {
  source?: RepositorySource
  rootPath?: string
}

export type SaveFileOptions = RepositoryLoadOptions & {
  expectedModifiedAt?: string
}
