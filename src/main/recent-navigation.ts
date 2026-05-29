import { findRepositoryWindowIndex } from './session-store'
import type { RecentFileState } from '../shared/types'

type RecentWindow = {
  webContents: {
    send: (channel: string, payload: unknown) => void
  }
  isMinimized?: () => boolean
  restore?: () => void
  show?: () => void
  focus?: () => void
}

type MenuModifierEvent = {
  metaKey?: boolean
  altKey?: boolean
}

type CreateWindow = (repoPath?: string, file?: RecentFileState) => void

type RecentRepositoryNavigationDependencies<Window extends RecentWindow> = {
  getAllWindows: () => Window[]
  getFocusedWindow: () => Window | undefined | null
  getWindowRepositoryPath: (window: Window) => string | undefined
  createWindow: CreateWindow
}

type RecentFileNavigationDependencies<Window extends RecentWindow> = {
  getAllWindows: () => Window[]
  getFocusedWindow: () => Window | undefined | null
  sendOpenFile: (window: Window, file: RecentFileState) => void
  createWindow: CreateWindow
}

export function shouldOpenInNewWindow(event: MenuModifierEvent): boolean {
  return Boolean(event.metaKey || event.altKey)
}

export function openRecentRepository<Window extends RecentWindow>(
  repoPath: string,
  {
    getAllWindows,
    getFocusedWindow,
    getWindowRepositoryPath,
    createWindow
  }: RecentRepositoryNavigationDependencies<Window>
): void {
  const openWindows = getAllWindows()
  const windowIndex = findRepositoryWindowIndex(repoPath, openWindows.map(getWindowRepositoryPath))
  const repositoryWindow = windowIndex >= 0 ? openWindows[windowIndex] : undefined

  if (repositoryWindow) {
    if (repositoryWindow.isMinimized?.()) repositoryWindow.restore?.()
    repositoryWindow.show?.()
    repositoryWindow.focus?.()
    return
  }

  const targetWindow = getFocusedWindow() ?? openWindows[0]

  if (targetWindow) {
    targetWindow.webContents.send('repository:open-path', repoPath)
    return
  }

  createWindow(repoPath)
}

export function openRecentFile<Window extends RecentWindow>(
  file: RecentFileState,
  {
    getFocusedWindow,
    getAllWindows,
    sendOpenFile,
    createWindow
  }: RecentFileNavigationDependencies<Window>
): void {
  const targetWindow = getFocusedWindow() ?? getAllWindows()[0]

  if (targetWindow) {
    sendOpenFile(targetWindow, file)
    return
  }

  createWindow(file.repoPath, file)
}

export function openRecentRepositoryMenuItem<Window extends RecentWindow>(
  repoPath: string,
  event: MenuModifierEvent,
  dependencies: RecentRepositoryNavigationDependencies<Window>
): void {
  if (shouldOpenInNewWindow(event)) {
    dependencies.createWindow(repoPath)
    return
  }

  openRecentRepository(repoPath, dependencies)
}

export function openRecentFileMenuItem<Window extends RecentWindow>(
  file: RecentFileState,
  event: MenuModifierEvent,
  dependencies: RecentFileNavigationDependencies<Window> &
    RecentRepositoryNavigationDependencies<Window>
): void {
  if (shouldOpenInNewWindow(event)) {
    dependencies.createWindow(file.repoPath, file)
    return
  }

  openRecentFile(file, dependencies)
}
