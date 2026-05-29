import { useEffect } from 'react'
import type { OpenFileTab } from '../app-navigation'
import type { RepositoryPayload } from '../../../shared/types'

export function useSessionPersistence({
  repository,
  selectedPath,
  activeFilePath,
  activeFileTabId,
  openFileTabs,
  expandedPaths,
  sidebarWidth
}: {
  repository: RepositoryPayload | undefined
  selectedPath: string
  activeFilePath: string | undefined
  activeFileTabId: string | undefined
  openFileTabs: OpenFileTab[]
  expandedPaths: Set<string>
  sidebarWidth: number
}): void {
  useEffect(() => {
    if (!repository) return

    const handle = window.setTimeout(() => {
      void window.api.saveSession({
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath,
        activeFilePath,
        activeFileTabId,
        openFileTabs,
        expandedPaths: Array.from(expandedPaths),
        sidebarWidth
      })
    }, 250)

    return () => window.clearTimeout(handle)
  }, [
    activeFilePath,
    activeFileTabId,
    expandedPaths,
    openFileTabs,
    repository,
    selectedPath,
    sidebarWidth
  ])
}
