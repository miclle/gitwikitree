import {
  createFileTab,
  moveActiveTabHistory,
  navigateFileTabs,
  type OpenFileTab
} from './app-navigation'
import type { NavigationTarget } from '../../shared/types'

export type WorkspaceNavigationPatch = {
  selectedPath: string
  activeFilePath?: string
  activeFileTabId?: string
  openFileTabs: OpenFileTab[]
}

function activeFilePathForTarget(target: NavigationTarget | undefined): string | undefined {
  return target?.type === 'directory' ? undefined : target?.path
}

export function createWorkspaceNavigationPatch({
  openFileTabs,
  activeFileTabId,
  target,
  openInNewTab,
  nextTabId
}: {
  openFileTabs: OpenFileTab[]
  activeFileTabId?: string
  target: NavigationTarget
  openInNewTab: boolean
  nextTabId: string
}): WorkspaceNavigationPatch {
  const result = navigateFileTabs({
    tabs: openFileTabs,
    activeTabId: activeFileTabId,
    target,
    openInNewTab,
    nextTabId
  })

  return {
    selectedPath: target.path,
    activeFilePath: activeFilePathForTarget(target),
    activeFileTabId: result.activeTabId,
    openFileTabs: result.tabs
  }
}

export function createSingleFileTabPatch(
  target: NavigationTarget,
  nextTabId: string
): WorkspaceNavigationPatch {
  const tab = createFileTab(target, nextTabId)

  return {
    selectedPath: target.path,
    activeFilePath: activeFilePathForTarget(target),
    activeFileTabId: tab.id,
    openFileTabs: [tab]
  }
}

export function mergeOpenedFileTab(
  openFileTabs: OpenFileTab[],
  openedTab: OpenFileTab
): OpenFileTab[] {
  return [...openFileTabs.filter((item) => item.path !== openedTab.path), openedTab]
}

export function createResetNavigationPatch(): WorkspaceNavigationPatch {
  return {
    selectedPath: '',
    activeFilePath: undefined,
    activeFileTabId: undefined,
    openFileTabs: []
  }
}

export function createCloseFileTabPatch({
  openFileTabs,
  activeFileTabId,
  closingTabId
}: {
  openFileTabs: OpenFileTab[]
  activeFileTabId?: string
  closingTabId: string
}): WorkspaceNavigationPatch & { previewPath: string } {
  const tabIndex = openFileTabs.findIndex((tab) => tab.id === closingTabId)
  const nextTabs = openFileTabs.filter((tab) => tab.id !== closingTabId)

  if (activeFileTabId !== closingTabId) {
    const currentTarget = openFileTabs.find((tab) => tab.id === activeFileTabId)

    return {
      selectedPath: currentTarget?.path ?? '',
      activeFilePath: activeFilePathForTarget(currentTarget),
      activeFileTabId,
      openFileTabs: nextTabs,
      previewPath: currentTarget?.path ?? ''
    }
  }

  const nextTab = nextTabs[Math.min(tabIndex, nextTabs.length - 1)]

  return {
    selectedPath: nextTab?.path ?? '',
    activeFilePath: activeFilePathForTarget(nextTab),
    activeFileTabId: nextTab?.id,
    openFileTabs: nextTabs,
    previewPath: nextTab?.path ?? ''
  }
}

export function createHistoryNavigationPatch(
  openFileTabs: OpenFileTab[],
  activeFileTabId: string | undefined,
  delta: -1 | 1
): (WorkspaceNavigationPatch & { target?: NavigationTarget }) | undefined {
  const result = moveActiveTabHistory(openFileTabs, activeFileTabId, delta)
  if (!result.target) return undefined

  return {
    selectedPath: result.target.path,
    activeFilePath: activeFilePathForTarget(result.target),
    activeFileTabId,
    openFileTabs: result.tabs,
    target: result.target
  }
}
