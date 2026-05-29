export const maxRecentFiles = 12
export const maxRecentRepositories = 12
export const maxOpenFileTabs = 30

import type {
  NavigationTarget,
  OpenFileTabState,
  ProjectSessionState,
  RecentFileState,
  RecentRepositoryState,
  SessionState,
  WindowState
} from '../shared/types'

const emptySessionState: SessionState = {
  selectedPath: '',
  openFileTabs: [],
  expandedPaths: [''],
  projectSessions: {},
  recentRepositories: [],
  recentFiles: []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isSafeRelativePath(value: string): boolean {
  return !value.includes('\0') && !value.startsWith('/') && !value.split('/').includes('..')
}

function normalizeRelativePath(value: unknown): string {
  const path = asString(value)
  return path && isSafeRelativePath(path) ? path : ''
}

function normalizeOptionalRelativePath(value: unknown): string | undefined {
  const path = normalizeRelativePath(value)
  return path || undefined
}

function normalizeNavigationTargetType(value: unknown): NavigationTarget['type'] {
  return value === 'directory' || value === 'file' ? value : undefined
}

function normalizeOpenFileTabs(value: unknown): OpenFileTabState[] {
  if (!Array.isArray(value)) return []

  const seenIds = new Set<string>()
  const tabs: OpenFileTabState[] = []

  for (const item of value) {
    const record = asRecord(item)
    const path = normalizeRelativePath(record.path)
    const name = asString(record.name)
    const id = asString(record.id)
    const type = normalizeNavigationTargetType(record.type)

    if ((!path && type !== 'directory') || !name || (id && seenIds.has(id))) continue

    const fallbackTarget = { path, name, ...(type ? { type } : {}) }
    const rawHistory = Array.isArray(record.history) ? record.history : []
    const history = rawHistory
      .map((historyItem) => {
        const historyRecord = asRecord(historyItem)
        const historyPath = normalizeOptionalRelativePath(historyRecord.path)
        const historyName = asString(historyRecord.name)
        const historyType = normalizeNavigationTargetType(historyRecord.type)

        return historyPath && historyName
          ? { path: historyPath, name: historyName, ...(historyType ? { type: historyType } : {}) }
          : undefined
      })
      .filter((historyItem): historyItem is NavigationTarget => Boolean(historyItem))
    const normalizedHistory = history.length ? history : [fallbackTarget]
    const rawHistoryIndex = record.historyIndex
    const historyIndex =
      typeof rawHistoryIndex === 'number' && Number.isInteger(rawHistoryIndex)
        ? Math.min(Math.max(rawHistoryIndex, 0), normalizedHistory.length - 1)
        : normalizedHistory.findIndex((historyItem) => historyItem.path === path)

    if (id) seenIds.add(id)
    tabs.push({
      path,
      name,
      ...(type ? { type } : {}),
      ...(id ? { id } : {}),
      history: normalizedHistory,
      historyIndex: historyIndex >= 0 ? historyIndex : normalizedHistory.length - 1
    })
    if (tabs.length >= maxOpenFileTabs) break
  }

  return tabs
}

function normalizeExpandedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return ['']

  const paths = value
    .map((item) => (typeof item === 'string' ? item : ''))
    .filter((item) => item === '' || isSafeRelativePath(item))

  return Array.from(new Set(['', ...paths]))
}

function normalizeRecentFiles(value: unknown): RecentFileState[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const files: RecentFileState[] = []

  for (const item of value) {
    const record = asRecord(item)
    const repoPath = asString(record.repoPath)
    const filePath = normalizeOptionalRelativePath(record.filePath)
    const name = asString(record.name)
    const openedAt = asString(record.openedAt)
    const rootPath = asString(record.rootPath)
    const activeRef = asString(record.activeRef)
    const source = record.source
    const normalizedSource =
      source === 'git-ref' || source === 'worktree' || source === 'working-tree'
        ? source
        : undefined

    if (!repoPath || !filePath || !name || !openedAt) continue

    const key = `${repoPath}\0${filePath}`
    if (seen.has(key)) continue

    seen.add(key)
    files.push({
      repoPath,
      filePath,
      name,
      openedAt,
      ...(rootPath ? { rootPath } : {}),
      ...(activeRef ? { activeRef } : {}),
      ...(normalizedSource ? { source: normalizedSource } : {})
    })
    if (files.length >= maxRecentFiles) break
  }

  return files
}

function nameFromPath(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? path
}

function normalizeRecentRepositories(value: unknown): RecentRepositoryState[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const repositories: RecentRepositoryState[] = []

  for (const item of value) {
    const record = asRecord(item)
    const repoPath = asString(record.repoPath)
    const rootPath = asString(record.rootPath)
    const name = asString(record.name)
    const openedAt = asString(record.openedAt)
    const activeRef = asString(record.activeRef)
    const source = record.source
    const normalizedSource =
      source === 'git-ref' || source === 'worktree' || source === 'working-tree'
        ? source
        : undefined

    if (!repoPath || !name || !openedAt || seen.has(repoPath)) continue

    seen.add(repoPath)
    repositories.push({
      repoPath,
      name,
      openedAt,
      ...(rootPath ? { rootPath } : {}),
      ...(activeRef ? { activeRef } : {}),
      ...(normalizedSource ? { source: normalizedSource } : {})
    })
    if (repositories.length >= maxRecentRepositories) break
  }

  return repositories
}

function normalizeCoordinate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function normalizeDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 320 && value <= 10000
    ? value
    : fallback
}

function normalizeSidebarWidth(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 170 && value <= 520
    ? value
    : undefined
}

function normalizeWindowState(value: unknown): WindowState | undefined {
  const record = asRecord(value)
  if (!Object.keys(record).length) return undefined

  return {
    ...(normalizeCoordinate(record.x) !== undefined ? { x: normalizeCoordinate(record.x) } : {}),
    ...(normalizeCoordinate(record.y) !== undefined ? { y: normalizeCoordinate(record.y) } : {}),
    width: normalizeDimension(record.width, 1220),
    height: normalizeDimension(record.height, 820),
    ...(typeof record.isMaximized === 'boolean' ? { isMaximized: record.isMaximized } : {})
  }
}

function getRecentRepositoriesFromFiles(recentFiles: RecentFileState[]): RecentRepositoryState[] {
  const seen = new Set<string>()
  const repositories: RecentRepositoryState[] = []

  for (const file of recentFiles) {
    if (seen.has(file.repoPath)) continue

    seen.add(file.repoPath)
    repositories.push({
      repoPath: file.repoPath,
      rootPath: file.rootPath,
      name: nameFromPath(file.repoPath),
      openedAt: file.openedAt,
      activeRef: file.activeRef,
      source: file.source
    })
    if (repositories.length >= maxRecentRepositories) break
  }

  return repositories
}

function normalizeProjectSessionState(value: unknown): ProjectSessionState {
  const record = asRecord(value)
  const source = record.source
  const repositoryPath = asString(record.repositoryPath)
  const rootPath = asString(record.rootPath)
  const activeRef = asString(record.activeRef)
  const openFileTabs = normalizeOpenFileTabs(record.openFileTabs)
  const activeFilePath = normalizeOptionalRelativePath(record.activeFilePath)
  const activeFileTabId = asString(record.activeFileTabId)
  const sidebarWidth = normalizeSidebarWidth(record.sidebarWidth)
  const windowState = normalizeWindowState(record.windowState)
  const normalizedSource =
    source === 'git-ref' || source === 'worktree' || source === 'working-tree' ? source : undefined

  return {
    ...(repositoryPath ? { repositoryPath } : {}),
    ...(rootPath ? { rootPath } : {}),
    ...(activeRef ? { activeRef } : {}),
    ...(normalizedSource ? { source: normalizedSource } : {}),
    selectedPath: normalizeRelativePath(record.selectedPath),
    ...(activeFilePath ? { activeFilePath } : {}),
    ...(activeFileTabId ? { activeFileTabId } : {}),
    openFileTabs,
    expandedPaths: normalizeExpandedPaths(record.expandedPaths),
    ...(sidebarWidth ? { sidebarWidth } : {}),
    ...(windowState ? { windowState } : {})
  }
}

function projectSessionFromSessionState(sessionState: ProjectSessionState): ProjectSessionState {
  return normalizeProjectSessionState(sessionState)
}

function normalizeProjectSessions(value: unknown): Record<string, ProjectSessionState> {
  const record = asRecord(value)
  const projectSessions: Record<string, ProjectSessionState> = {}

  for (const [repoPath, projectSession] of Object.entries(record)) {
    const normalized = normalizeProjectSessionState({
      ...asRecord(projectSession),
      repositoryPath: asString(asRecord(projectSession).repositoryPath) ?? repoPath
    })
    if (!normalized.repositoryPath) continue

    projectSessions[normalized.repositoryPath] = normalized
  }

  return projectSessions
}

export function normalizeSessionState(
  value: unknown,
  options: { migrateCurrentProject?: boolean } = {}
): SessionState {
  const record = asRecord(value)
  const recentFiles = normalizeRecentFiles(record.recentFiles)
  const recentRepositories = normalizeRecentRepositories(record.recentRepositories)
  const projectSessions = normalizeProjectSessions(record.projectSessions)
  const currentProject = normalizeProjectSessionState(record)
  const migrateCurrentProject = options.migrateCurrentProject ?? true

  if (
    migrateCurrentProject &&
    currentProject.repositoryPath &&
    !projectSessions[currentProject.repositoryPath]
  ) {
    projectSessions[currentProject.repositoryPath] = projectSessionFromSessionState(currentProject)
  }

  return {
    ...currentProject,
    projectSessions,
    recentRepositories: recentRepositories.length
      ? recentRepositories
      : getRecentRepositoriesFromFiles(recentFiles),
    recentFiles
  }
}

export function recordRecentFile(
  current: RecentFileState[],
  nextFile: RecentFileState
): RecentFileState[] {
  return normalizeRecentFiles([
    nextFile,
    ...current.filter(
      (item) => item.repoPath !== nextFile.repoPath || item.filePath !== nextFile.filePath
    )
  ])
}

export function getRecentFileOpenPayload(file: RecentFileState): RecentFileState {
  return normalizeRecentFiles([file])[0]
}

export function recordRecentRepository(
  current: RecentRepositoryState[],
  nextRepository: RecentRepositoryState
): RecentRepositoryState[] {
  return normalizeRecentRepositories([
    nextRepository,
    ...current.filter((item) => item.repoPath !== nextRepository.repoPath)
  ])
}

export function getRecentRepositories(
  recentRepositories: Array<RecentRepositoryState | RecentFileState>,
  recentFiles: RecentFileState[] = []
): string[] {
  const seen = new Set<string>()
  const repositories: string[] = []

  for (const item of [...recentRepositories, ...recentFiles]) {
    if (seen.has(item.repoPath)) continue

    seen.add(item.repoPath)
    repositories.push(item.repoPath)
  }

  return repositories
}

export function findRepositoryWindowIndex(
  repoPath: string,
  windowRepositoryPaths: Array<string | undefined>
): number {
  return windowRepositoryPaths.findIndex((windowRepoPath) => windowRepoPath === repoPath)
}

export function clearRecentFiles(sessionState: SessionState): SessionState {
  return normalizeSessionState({
    ...sessionState,
    recentRepositories: [],
    recentFiles: []
  })
}

export function getProjectSessionState(
  sessionState: SessionState,
  repoPath: string
): ProjectSessionState | undefined {
  return sessionState.projectSessions[repoPath]
}

export function getOpenFileTabsForRecentFile({
  currentRepositoryPath,
  nextRepositoryPath,
  currentTabs,
  nextTab
}: {
  currentRepositoryPath?: string
  nextRepositoryPath: string
  currentTabs: OpenFileTabState[]
  nextTab: OpenFileTabState
}): OpenFileTabState[] {
  const baseTabs = currentRepositoryPath === nextRepositoryPath ? currentTabs : []

  return normalizeOpenFileTabs([...baseTabs.filter((tab) => tab.path !== nextTab.path), nextTab])
}

export function mergeSessionState(
  current: SessionState,
  next: Partial<SessionState>,
  options: { syncProjectSession?: boolean } = {}
): SessionState {
  const projectSessions = {
    ...current.projectSessions,
    ...next.projectSessions
  }
  const merged = normalizeSessionState({
    ...emptySessionState,
    ...current,
    ...next,
    projectSessions,
    recentRepositories: next.recentRepositories ?? current.recentRepositories,
    recentFiles: next.recentFiles ?? current.recentFiles
  })
  const syncProjectSession = options.syncProjectSession ?? true

  if (!syncProjectSession || !merged.repositoryPath) {
    return normalizeSessionState(
      {
        ...merged,
        projectSessions
      },
      { migrateCurrentProject: false }
    )
  }

  return normalizeSessionState({
    ...merged,
    projectSessions: {
      ...merged.projectSessions,
      [merged.repositoryPath]: {
        ...merged.projectSessions[merged.repositoryPath],
        repositoryPath: merged.repositoryPath,
        rootPath: merged.rootPath,
        activeRef: merged.activeRef,
        source: merged.source,
        selectedPath: merged.selectedPath,
        activeFilePath: merged.activeFilePath,
        activeFileTabId: merged.activeFileTabId,
        openFileTabs: merged.openFileTabs,
        expandedPaths: merged.expandedPaths,
        sidebarWidth: merged.sidebarWidth,
        windowState:
          merged.windowState ?? merged.projectSessions[merged.repositoryPath]?.windowState
      }
    }
  })
}

export function createEmptySessionState(): SessionState {
  return {
    ...emptySessionState,
    openFileTabs: [],
    expandedPaths: [''],
    projectSessions: {},
    recentRepositories: [],
    recentFiles: []
  }
}
