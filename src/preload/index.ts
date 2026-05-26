import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  newWindow: (): Promise<void> => ipcRenderer.invoke('window:new'),
  pickRepository: () => ipcRenderer.invoke('repository:pick'),
  loadRepository: (repoPath: string) => ipcRenderer.invoke('repository:load', repoPath),
  loadRef: (repoPath: string, ref: string, rootPath?: string) =>
    ipcRenderer.invoke('repository:load-ref', repoPath, ref, rootPath),
  openWorktree: (repoPath: string, ref: string) =>
    ipcRenderer.invoke('repository:open-worktree', repoPath, ref),
  previewPath: (
    repoPath: string,
    relativePath: string,
    options?: {
      ref?: string
      source?: 'working-tree' | 'git-ref' | 'worktree'
      rootPath?: string
    }
  ) => ipcRenderer.invoke('repository:preview', repoPath, relativePath, options),
  saveFile: (repoPath: string, relativePath: string, content: string) =>
    ipcRenderer.invoke('repository:save-file', repoPath, relativePath, content),
  onOpenRepositoryPath: (callback: (repoPath: string) => void) => {
    const listener = (_event: IpcRendererEvent, repoPath: string): void => callback(repoPath)
    ipcRenderer.on('repository:open-path', listener)

    return () => ipcRenderer.removeListener('repository:open-path', listener)
  },
  onOpenRepositoryRequest: (callback: () => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('repository:open-request', listener)

    return () => ipcRenderer.removeListener('repository:open-request', listener)
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
