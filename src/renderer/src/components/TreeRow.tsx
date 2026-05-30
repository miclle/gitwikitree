import { type CSSProperties } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { iconForNode, shouldOpenInNewTab } from '../app-utils'
import type { TreeNode } from '../../../shared/types'

export function TreeRow({
  node,
  level,
  expandedPaths,
  selectedPath,
  dirtyPath,
  onSelect,
  onToggle,
  onOpenContextMenu
}: {
  node: TreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  dirtyPath?: string
  onSelect: (node: TreeNode, options?: { openInNewTab?: boolean }) => Promise<void>
  onToggle: (path: string) => void
  onOpenContextMenu: (node: TreeNode) => Promise<void>
}): React.JSX.Element {
  const expanded = expandedPaths.has(node.path)
  const hasChildren = node.type === 'directory' && Boolean(node.children?.length)
  const isDirty = dirtyPath === node.path
  const selectNode = (openInNewTab = false): void => {
    void onSelect(node, { openInNewTab })
  }

  return (
    <>
      <div
        aria-selected={selectedPath === node.path}
        className={selectedPath === node.path ? 'tree-row selected' : 'tree-row'}
        data-tree-item="true"
        role="treeitem"
        style={{ '--level': level } as CSSProperties}
        tabIndex={0}
        onClick={(event) => selectNode(shouldOpenInNewTab(event))}
        onAuxClick={(event) => {
          if (!shouldOpenInNewTab(event)) return
          event.preventDefault()
          selectNode(true)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          void onOpenContextMenu(node)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          selectNode()
        }}
      >
        {node.type === 'directory' ? (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
            className="tree-toggle"
            disabled={!hasChildren}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.path)
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <span className="tree-node-button">
          {iconForNode(node, expanded)}
          <span className="tree-node-name">{node.name}</span>
          {isDirty && (
            <span className="tree-node-dirty" aria-label="Unsaved changes" title="Unsaved" />
          )}
          {!isDirty && node.gitStatus === 'modified' && (
            <span className="tree-node-git-status" aria-label="Modified" title="Modified">
              M
            </span>
          )}
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children" style={{ '--level': level } as CSSProperties}>
          {node.children?.map((child) => (
            <TreeRow
              expandedPaths={expandedPaths}
              key={child.path}
              level={level + 1}
              node={child}
              selectedPath={selectedPath}
              dirtyPath={dirtyPath}
              onSelect={onSelect}
              onToggle={onToggle}
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}
        </div>
      )}
    </>
  )
}
