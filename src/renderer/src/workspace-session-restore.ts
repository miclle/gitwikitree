import type { OpenFileTab } from './app-navigation'
import { hydrateOpenFileTab, parentPaths } from './workspace-paths'
import { resolveRepositoryNavigationTarget } from './repository-navigation'
import type { NavigationTarget, ProjectSessionState, RepositoryPayload } from '../../shared/types'

export type RestoredRepositorySession = {
  openFileTabs: OpenFileTab[]
  activeFilePath?: string
  activeFileTabId?: string
  selectedPath: string
  expandedPaths: Set<string>
}

function resolveHistoryTargets(
  repository: RepositoryPayload,
  history: NavigationTarget[] | undefined
): NavigationTarget[] | undefined {
  return history?.map((target) => {
    return resolveRepositoryNavigationTarget(repository, target.path)?.target ?? target
  })
}

export function createRestoredRepositorySession(
  repository: RepositoryPayload,
  session: ProjectSessionState
): RestoredRepositorySession {
  const openFileTabs = session.openFileTabs
    .map((tab) => {
      const resolved = resolveRepositoryNavigationTarget(repository, tab.path)
      if (!resolved) return undefined

      return {
        ...tab,
        ...resolved.target,
        history: resolveHistoryTargets(repository, tab.history)
      }
    })
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .map((tab, index) => hydrateOpenFileTab(tab, index))
  const activeTab =
    openFileTabs.find((tab) => tab.id === session.activeFileTabId) ?? openFileTabs[0]
  const activeFileTabId =
    activeTab?.id ?? openFileTabs.find((tab) => tab.path === session.activeFilePath)?.id
  const activeFilePath = activeTab?.type === 'directory' ? undefined : activeTab?.path
  const selectedPath = activeTab?.path ?? session.selectedPath ?? ''
  const selectedTarget = resolveRepositoryNavigationTarget(repository, selectedPath)
  const nextSelectedPath = selectedTarget?.target.path ?? ''

  return {
    openFileTabs,
    activeFilePath,
    activeFileTabId,
    selectedPath: nextSelectedPath,
    expandedPaths: new Set([
      ...(session.expandedPaths.length ? session.expandedPaths : ['']),
      ...parentPaths(nextSelectedPath)
    ])
  }
}
