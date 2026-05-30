import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  RepositoryLoadOptions,
  SaveFileOptions,
  TreeItemOpenPayload
} from '../shared/types'

let pendingOpenTreeItem: TreeItemOpenPayload | undefined
const openTreeItemCallbacks = new Set<(payload: TreeItemOpenPayload) => void>()

ipcRenderer.on('repository:open-tree-item', (_event, payload: TreeItemOpenPayload) => {
  if (openTreeItemCallbacks.size === 0) {
    pendingOpenTreeItem = payload
    return
  }

  for (const callback of openTreeItemCallbacks) callback(payload)
})

// Custom APIs for renderer
const api = {
  newWindow: (): Promise<void> => ipcRenderer.invoke('window:new'),
  controlWindow: (action: 'close' | 'minimize' | 'toggle-maximize'): Promise<void> =>
    ipcRenderer.invoke('window:control', action),
  showTreeItemContextMenu: (item: TreeItemOpenPayload): Promise<void> =>
    ipcRenderer.invoke('context-menu:tree-item', item),
  showMarkdownLinkContextMenu: (item: MarkdownLinkContext): Promise<void> =>
    ipcRenderer.invoke('context-menu:markdown-link', item),
  pickRepository: () => ipcRenderer.invoke('repository:pick'),
  loadRepository: (repoPath: string) => ipcRenderer.invoke('repository:load', repoPath),
  checkoutBranch: (repoPath: string, branch: string) =>
    ipcRenderer.invoke('repository:checkout-branch', repoPath, branch),
  openWorktree: (repoPath: string, ref: string) =>
    ipcRenderer.invoke('repository:open-worktree', repoPath, ref),
  previewPath: (
    repoPath: string,
    relativePath: string,
    options?: {
      source?: 'working-tree' | 'worktree'
      rootPath?: string
    }
  ) => ipcRenderer.invoke('repository:preview', repoPath, relativePath, options),
  saveFile: (repoPath: string, relativePath: string, content: string, options?: SaveFileOptions) =>
    ipcRenderer.invoke('repository:save-file', repoPath, relativePath, content, options),
  searchRepository: (repoPath: string, query: string, options?: RepositoryLoadOptions) =>
    ipcRenderer.invoke('repository:search', repoPath, query, options),
  getSession: () => ipcRenderer.invoke('session:get'),
  getProjectSession: (repoPath: string) => ipcRenderer.invoke('session:get-project', repoPath),
  saveSession: (session: unknown) => ipcRenderer.invoke('session:save', session),
  onOpenRepositoryPath: (callback: (repoPath: string) => void) => {
    const listener = (_event: IpcRendererEvent, repoPath: string): void => callback(repoPath)
    ipcRenderer.on('repository:open-path', listener)

    return () => ipcRenderer.removeListener('repository:open-path', listener)
  },
  onOpenRepositoryRequest: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('repository:open-request', listener)

    return () => ipcRenderer.removeListener('repository:open-request', listener)
  },
  onOpenFilePath: (
    callback: (payload: {
      repoPath: string
      rootPath?: string
      filePath: string
      name: string
      openedAt: string
      activeRef?: string
      source?: 'working-tree' | 'worktree'
    }) => void
  ) => {
    const listener = (
      _event: IpcRendererEvent,
      payload: {
        repoPath: string
        rootPath?: string
        filePath: string
        name: string
        openedAt: string
        activeRef?: string
        source?: 'working-tree' | 'worktree'
      }
    ): void => callback(payload)
    ipcRenderer.on('repository:open-file', listener)

    return () => ipcRenderer.removeListener('repository:open-file', listener)
  },
  onOpenTreeItem: (callback: (payload: TreeItemOpenPayload) => void) => {
    openTreeItemCallbacks.add(callback)

    if (pendingOpenTreeItem) {
      const payload = pendingOpenTreeItem
      pendingOpenTreeItem = undefined
      callback(payload)
    }

    return () => {
      openTreeItemCallbacks.delete(callback)
    }
  },
  onOpenTreeItemInNewTab: (callback: (path: string) => void) => {
    const listener = (_event: IpcRendererEvent, path: string): void => callback(path)
    ipcRenderer.on('tree-item:open-in-new-tab', listener)

    return () => ipcRenderer.removeListener('tree-item:open-in-new-tab', listener)
  },
  onOpenMarkdownLink: (callback: (payload: MarkdownLinkOpenPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: MarkdownLinkOpenPayload): void =>
      callback(payload)
    ipcRenderer.on('markdown-link:open', listener)

    return () => ipcRenderer.removeListener('markdown-link:open', listener)
  },
  onCloseCurrentTabOrWindow: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('tab:close-current-or-window', listener)

    return () => ipcRenderer.removeListener('tab:close-current-or-window', listener)
  },
  onOpenCurrentTabSearch: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('search:open-current-tab', listener)

    return () => ipcRenderer.removeListener('search:open-current-tab', listener)
  },
  onOpenGlobalSearch: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('search:open-global', listener)

    return () => ipcRenderer.removeListener('search:open-global', listener)
  },
  onSaveCurrentFile: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('file:save-current', listener)

    return () => ipcRenderer.removeListener('file:save-current', listener)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
