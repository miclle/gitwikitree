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
  branch: string
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
  content?: string
  dataUrl?: string
  size: number
}

export type PreviewPayload = DirectoryPreview | FilePreview

export type GitWikitreeAPI = {
  newWindow: () => Promise<void>
  pickRepository: () => Promise<RepositoryPayload | undefined>
  loadRepository: (repoPath: string) => Promise<RepositoryPayload>
  previewPath: (repoPath: string, relativePath: string) => Promise<PreviewPayload>
  onOpenRepositoryPath: (callback: (repoPath: string) => void) => () => void
  onOpenRepositoryRequest: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: GitWikitreeAPI
  }
}
