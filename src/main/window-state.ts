import { getProjectSessionState, mergeSessionState } from './session-store'
import type { SessionState, WindowState } from '../shared/types'

type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

type WindowStateSource = {
  isMaximized: () => boolean
  getNormalBounds: () => Bounds
  getBounds: () => Bounds
}

export function getSavedWindowState(
  sessionState: SessionState,
  repoPath?: string
): WindowState | undefined {
  return repoPath
    ? getProjectSessionState(sessionState, repoPath)?.windowState
    : sessionState.windowState
}

export function getBrowserWindowBounds(
  sessionState: SessionState,
  repoPath?: string
): Partial<WindowState> {
  const windowState = getSavedWindowState(sessionState, repoPath)
  if (!windowState) return {}

  return {
    ...(typeof windowState.x === 'number' ? { x: windowState.x } : {}),
    ...(typeof windowState.y === 'number' ? { y: windowState.y } : {}),
    width: windowState.width,
    height: windowState.height
  }
}

export function readWindowState(browserWindow: WindowStateSource): WindowState {
  const bounds = browserWindow.isMaximized()
    ? browserWindow.getNormalBounds()
    : browserWindow.getBounds()

  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: browserWindow.isMaximized()
  }
}

export function mergeWindowStateIntoSession(
  sessionState: SessionState,
  repoPath: string | undefined,
  windowState: WindowState
): SessionState {
  if (!repoPath) {
    return { ...sessionState, windowState }
  }

  return mergeSessionState(
    sessionState,
    {
      projectSessions: {
        [repoPath]: {
          repositoryPath: repoPath,
          selectedPath: '',
          openFileTabs: [],
          expandedPaths: [''],
          ...getProjectSessionState(sessionState, repoPath),
          windowState
        }
      }
    },
    { syncProjectSession: false }
  )
}
