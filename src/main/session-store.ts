export const maxRecentFiles = 12
export const maxRecentRepositories = 12
export const maxOpenFileTabs = 30

export type OpenFileTabState = {
  path: string
  name: string
  id?: string
  history?: Array<{ path: string; name: string }>
  historyIndex?: number
}

export type RecentFileState = {
  repoPath: string
  rootPath?: string
  filePath: string
  name: string
  openedAt: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
}

export type RecentRepositoryState = {
  repoPath: string
  rootPath?: string
  name: string
  openedAt: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
}

export type SessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
  selectedPath: string
  activeFilePath?: string
  activeFileTabId?: string
  openFileTabs: OpenFileTabState[]
  expandedPaths: string[]
  recentRepositories: RecentRepositoryState[]
  recentFiles: RecentFileState[]
}

const emptySessionState: SessionState = {
  selectedPath: '',
  openFileTabs: [],
  expandedPaths: [''],
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

function normalizeOpenFileTabs(value: unknown): OpenFileTabState[] {
  if (!Array.isArray(value)) return []

  const seenIds = new Set<string>()
  const tabs: OpenFileTabState[] = []

  for (const item of value) {
    const record = asRecord(item)
    const path = normalizeOptionalRelativePath(record.path)
    const name = asString(record.name)
    const id = asString(record.id)

    if (!path || !name || (id && seenIds.has(id))) continue

    const fallbackTarget = { path, name }
    const rawHistory = Array.isArray(record.history) ? record.history : []
    const history = rawHistory
      .map((historyItem) => {
        const historyRecord = asRecord(historyItem)
        const historyPath = normalizeOptionalRelativePath(historyRecord.path)
        const historyName = asString(historyRecord.name)

        return historyPath && historyName ? { path: historyPath, name: historyName } : undefined
      })
      .filter((historyItem): historyItem is { path: string; name: string } => Boolean(historyItem))
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

export function normalizeSessionState(value: unknown): SessionState {
  const record = asRecord(value)
  const source = record.source
  const openFileTabs = normalizeOpenFileTabs(record.openFileTabs)
  const activeFilePath = normalizeOptionalRelativePath(record.activeFilePath)
  const activeFileTabId = asString(record.activeFileTabId)
  const recentFiles = normalizeRecentFiles(record.recentFiles)
  const recentRepositories = normalizeRecentRepositories(record.recentRepositories)

  return {
    repositoryPath: asString(record.repositoryPath),
    rootPath: asString(record.rootPath),
    activeRef: asString(record.activeRef),
    source:
      source === 'git-ref' || source === 'worktree' || source === 'working-tree'
        ? source
        : undefined,
    selectedPath: normalizeRelativePath(record.selectedPath),
    activeFilePath,
    activeFileTabId,
    openFileTabs,
    expandedPaths: normalizeExpandedPaths(record.expandedPaths),
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
  next: Partial<SessionState>
): SessionState {
  return normalizeSessionState({
    ...emptySessionState,
    ...current,
    ...next,
    recentRepositories: next.recentRepositories ?? current.recentRepositories,
    recentFiles: next.recentFiles ?? current.recentFiles
  })
}

export function createEmptySessionState(): SessionState {
  return {
    ...emptySessionState,
    openFileTabs: [],
    expandedPaths: [''],
    recentRepositories: [],
    recentFiles: []
  }
}
