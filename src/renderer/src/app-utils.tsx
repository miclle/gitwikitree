import { File, Folder } from 'lucide-react'
import { getTreeIcon } from './tree-icons'
export { getRepositoryLabel } from './repository-label'
export { fileNameFromPath, hydrateOpenFileTab, parentPaths } from './workspace-paths'
import type { TreeNode } from '../../shared/types'

export function shouldOpenInNewTab(event: {
  button?: number
  ctrlKey?: boolean
  metaKey?: boolean
}): boolean {
  return event.button === 1 || Boolean(event.ctrlKey || event.metaKey)
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
