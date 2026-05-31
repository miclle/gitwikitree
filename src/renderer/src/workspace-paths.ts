import type { OpenFileTab } from './app-navigation'
import type { NavigationTarget } from '../../shared/types'

export function fileNameFromPath(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function fallbackTabId(tab: NavigationTarget, index: number): string {
  return `tab-${index}-${tab.path.replace(/[^a-z0-9]/gi, '-')}`
}

export function hydrateOpenFileTab(
  tab: {
    path: string
    name: string
    type?: NavigationTarget['type']
    id?: string
    history?: NavigationTarget[]
    historyIndex?: number
  },
  index: number
): OpenFileTab {
  const target = { path: tab.path, name: tab.name, ...(tab.type ? { type: tab.type } : {}) }
  const history = tab.history?.length ? tab.history : [target]
  const historyIndex =
    typeof tab.historyIndex === 'number'
      ? Math.min(Math.max(tab.historyIndex, 0), history.length - 1)
      : history.findIndex((item) => item.path === tab.path)

  return {
    id: tab.id ?? fallbackTabId(tab, index),
    ...target,
    history,
    historyIndex: historyIndex >= 0 ? historyIndex : history.length - 1
  }
}

export function parentPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}
