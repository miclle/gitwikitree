export const maxRecentFiles = 12
export const maxOpenFileTabs = 30

export type OpenFileTabState = {
  path: string
  name: string
}

export type RecentFileState = {
  repoPath: string
  filePath: string
  name: string
  openedAt: string
}

export type SessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
  selectedPath: string
  activeFilePath?: string
  openFileTabs: OpenFileTabState[]
  expandedPaths: string[]
  recentFiles: RecentFileState[]
}

const emptySessionState: SessionState = {
  selectedPath: '',
  openFileTabs: [],
  expandedPaths: [''],
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

  const seen = new Set<string>()
  const tabs: OpenFileTabState[] = []

  for (const item of value) {
    const record = asRecord(item)
    const path = normalizeOptionalRelativePath(record.path)
    const name = asString(record.name)

    if (!path || !name || seen.has(path)) continue
    seen.add(path)
    tabs.push({ path, name })
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

    if (!repoPath || !filePath || !name || !openedAt) continue

    const key = `${repoPath}\0${filePath}`
    if (seen.has(key)) continue

    seen.add(key)
    files.push({ repoPath, filePath, name, openedAt })
    if (files.length >= maxRecentFiles) break
  }

  return files
}

export function normalizeSessionState(value: unknown): SessionState {
  const record = asRecord(value)
  const source = record.source
  const openFileTabs = normalizeOpenFileTabs(record.openFileTabs)
  const activeFilePath = normalizeOptionalRelativePath(record.activeFilePath)

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
    openFileTabs,
    expandedPaths: normalizeExpandedPaths(record.expandedPaths),
    recentFiles: normalizeRecentFiles(record.recentFiles)
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
    recentFiles: next.recentFiles ?? current.recentFiles
  })
}

export function createEmptySessionState(): SessionState {
  return { ...emptySessionState, openFileTabs: [], expandedPaths: [''], recentFiles: [] }
}
