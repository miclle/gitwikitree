import { type CSSProperties, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { iconForNode, shouldOpenInNewTab } from '../app-utils'
import type { TreeNode } from '../../../shared/types'

export function TreeRow({
  node,
  level,
  expandedPaths,
  selectedPath,
  dirtyPath,
  renamingPath,
  onSelect,
  onToggle,
  onOpenContextMenu,
  onRenameSubmit,
  onRenameCancel
}: {
  node: TreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  dirtyPath?: string
  renamingPath?: string
  onSelect: (node: TreeNode, options?: { openInNewTab?: boolean }) => Promise<void>
  onToggle: (path: string) => void
  onOpenContextMenu: (node: TreeNode) => Promise<void>
  onRenameSubmit: (path: string, nextName: string) => Promise<void>
  onRenameCancel: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const didSubmitRenameRef = useRef(false)
  const expanded = expandedPaths.has(node.path)
  const hasChildren = node.type === 'directory' && Boolean(node.children?.length)
  const isDirty = dirtyPath === node.path
  const isRenaming = renamingPath === node.path
  const selectNode = (openInNewTab = false): void => {
    void onSelect(node, { openInNewTab })
  }
  const submitRename = (nextName: string): void => {
    if (didSubmitRenameRef.current) return
    didSubmitRenameRef.current = true
    void onRenameSubmit(node.path, nextName)
  }

  useEffect(() => {
    if (!isRenaming) return
    didSubmitRenameRef.current = false
    renameInputRef.current?.focus()
    renameInputRef.current?.select()
  }, [isRenaming])

  const handleRenameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    event.stopPropagation()

    if (event.key === 'Escape') {
      event.preventDefault()
      didSubmitRenameRef.current = true
      onRenameCancel()
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      submitRename(event.currentTarget.value)
    }
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
            aria-label={t(expanded ? 'tree.collapse' : 'tree.expand', { name: node.name })}
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
          {isRenaming ? (
            <input
              ref={renameInputRef}
              aria-label={t('tree.renamePrompt', { name: node.name })}
              className="tree-rename-input"
              defaultValue={node.name}
              onBlur={(event) => submitRename(event.currentTarget.value)}
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.stopPropagation()}
              onKeyDown={handleRenameKeyDown}
            />
          ) : (
            <span className="tree-node-name">{node.name}</span>
          )}
          {isDirty && (
            <span
              className="tree-node-dirty"
              aria-label={t('app.unsavedChanges')}
              title={t('app.unsaved')}
            />
          )}
          {!isDirty && node.gitStatus === 'modified' && (
            <span
              className="tree-node-git-status"
              aria-label={t('tree.modified')}
              title={t('tree.modified')}
            >
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
              renamingPath={renamingPath}
              onSelect={onSelect}
              onToggle={onToggle}
              onOpenContextMenu={onOpenContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </>
  )
}
