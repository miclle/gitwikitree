import type {
  FileTabShortcutDirection,
  FileTabShortcutPosition,
  NavigationTarget
} from '../../shared/types'

export type { NavigationTarget }

export type OpenFileTab = NavigationTarget & {
  id: string
  history: NavigationTarget[]
  historyIndex: number
}

export type FileTabsNavigationResult = {
  tabs: OpenFileTab[]
  activeTabId: string
}

export function createFileTab(target: NavigationTarget, id: string): OpenFileTab {
  return {
    id,
    ...target,
    history: [target],
    historyIndex: 0
  }
}

function appendTabHistory(tab: OpenFileTab, target: NavigationTarget): OpenFileTab {
  const current = tab.history[tab.historyIndex]
  if (current?.path === target.path) {
    return {
      ...tab,
      ...target,
      history: tab.history.map((item, index) => (index === tab.historyIndex ? target : item))
    }
  }

  const history = [...tab.history.slice(0, tab.historyIndex + 1), target]

  return {
    ...tab,
    ...target,
    history,
    historyIndex: history.length - 1
  }
}

export function navigateFileTabs({
  tabs,
  activeTabId,
  target,
  openInNewTab,
  nextTabId
}: {
  tabs: OpenFileTab[]
  activeTabId?: string
  target: NavigationTarget
  openInNewTab: boolean
  nextTabId: string
}): FileTabsNavigationResult {
  if (openInNewTab || !activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
    return {
      tabs: [...tabs, createFileTab(target, nextTabId)],
      activeTabId: nextTabId
    }
  }

  return {
    tabs: tabs.map((tab) => (tab.id === activeTabId ? appendTabHistory(tab, target) : tab)),
    activeTabId
  }
}

export function moveActiveTabHistory(
  tabs: OpenFileTab[],
  activeTabId: string | undefined,
  delta: -1 | 1
): { tabs: OpenFileTab[]; target?: NavigationTarget } {
  if (!activeTabId) return { tabs }

  let target: NavigationTarget | undefined
  const nextTabs = tabs.map((tab) => {
    if (tab.id !== activeTabId) return tab

    const nextIndex = tab.historyIndex + delta
    if (nextIndex < 0 || nextIndex >= tab.history.length) return tab

    target = tab.history[nextIndex]
    return {
      ...tab,
      ...target,
      historyIndex: nextIndex
    }
  })

  return { tabs: nextTabs, target }
}

export function canMoveTabHistory(
  tabs: OpenFileTab[],
  activeTabId: string | undefined,
  delta: -1 | 1
): boolean {
  const activeTab = tabs.find((tab) => tab.id === activeTabId)
  if (!activeTab) return false

  const nextIndex = activeTab.historyIndex + delta
  return nextIndex >= 0 && nextIndex < activeTab.history.length
}

export function getFileTabForShortcutPosition(
  tabs: OpenFileTab[],
  position: FileTabShortcutPosition
): OpenFileTab | undefined {
  if (position === 9) return tabs.at(-1)

  return tabs[position - 1]
}

export function getAdjacentFileTab(
  tabs: OpenFileTab[],
  activeTabId: string | undefined,
  delta: FileTabShortcutDirection
): OpenFileTab | undefined {
  if (tabs.length < 2) return undefined

  const activeTabIndex = tabs.findIndex((tab) => tab.id === activeTabId)
  if (activeTabIndex < 0) return undefined

  const nextIndex = (activeTabIndex + delta + tabs.length) % tabs.length
  return tabs[nextIndex]
}
