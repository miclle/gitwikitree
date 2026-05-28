export type RepositorySource = 'working-tree' | 'git-ref' | 'worktree'

export type PreviewType = 'markdown' | 'html' | 'svg' | 'image' | 'text' | 'unsupported'

export type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
  index?: { name: string; path: string }
}

export type TreeItemOpenPayload = Pick<TreeNode, 'name' | 'path' | 'type'> & {
  repoPath: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
}

export type RepositoryRef = {
  name: string
  type: 'local' | 'remote'
  current: boolean
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
  previewType: PreviewType
  editable: boolean
  content?: string
  dataUrl?: string
  size: number
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

export type SessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
  selectedPath: string
  activeFilePath?: string
  activeFileTabId?: string
  openFileTabs: OpenFileTabState[]
  expandedPaths: string[]
  recentRepositories: RecentRepositoryState[]
  recentFiles: RecentFileState[]
}

export type RepositoryLoadOptions = {
  ref?: string
  source?: RepositorySource
  rootPath?: string
}
