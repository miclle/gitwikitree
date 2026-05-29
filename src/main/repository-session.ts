import { basename } from 'path'
import type { RecentRepositoryState, RepositoryPayload, SessionState } from '../shared/types'

export function createRepositorySessionReset(repository: RepositoryPayload): Partial<SessionState> {
  return {
    repositoryPath: repository.path,
    rootPath: repository.rootPath,
    activeRef: repository.activeRef,
    source: repository.source,
    selectedPath: '',
    activeFilePath: undefined,
    activeFileTabId: undefined,
    openFileTabs: [],
    expandedPaths: ['']
  }
}

export function createRecentRepositoryState(repository: RepositoryPayload): RecentRepositoryState {
  return {
    repoPath: repository.path,
    rootPath: repository.rootPath,
    name: basename(repository.path),
    openedAt: new Date().toISOString(),
    activeRef: repository.activeRef,
    source: repository.source
  }
}
