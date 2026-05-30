import { File, Folder } from 'lucide-react'
import { getTreeIcon } from './tree-icons'
export { getRepositoryLabel } from './repository-label'
import type { OpenFileTab } from './app-navigation'
import type { NavigationTarget, TreeNode } from '../../shared/types'

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

export function shouldOpenInNewTab(event: {
  button?: number
  ctrlKey?: boolean
  metaKey?: boolean
}): boolean {
  return event.button === 1 || Boolean(event.ctrlKey || event.metaKey)
}

export function parentPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

export function iconForNode(
  node: Pick<TreeNode, 'type' | 'name'>,
  expanded = false
): React.JSX.Element {
  const treeIcon = getTreeIcon(node, expanded)
  if (treeIcon) {
    return <img alt={treeIcon.alt} className="tree-icon" draggable={false} src={treeIcon.src} />
  }

  return node.type === 'directory' ? (
    <Folder className="tree-icon" size={16} />
  ) : (
    <File className="tree-icon" size={16} />
  )
}
