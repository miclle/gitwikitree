import { type MouseEvent as ReactMouseEvent, type Ref } from 'react'
import { iconForNode, shouldOpenInNewTab } from '../app-utils'
import type { TreeNode } from '../../../shared/types'

export function DirectoryListPreview({
  entries,
  rootRef,
  onSelectPath
}: {
  entries: TreeNode[] | undefined
  rootRef: Ref<HTMLDivElement>
  onSelectPath: (path: string, openInNewTab?: boolean) => boolean
}): React.JSX.Element {
  const handleAuxClick =
    (path: string) =>
    (event: ReactMouseEvent<HTMLButtonElement>): void => {
      if (!shouldOpenInNewTab(event)) return

      event.preventDefault()
      onSelectPath(path, true)
    }

  return (
    <div ref={rootRef} className="directory-list">
      {(entries ?? []).map((entry) => (
        <button
          key={entry.path}
          type="button"
          onAuxClick={handleAuxClick(entry.path)}
          onClick={(event) => onSelectPath(entry.path, shouldOpenInNewTab(event))}
        >
          {iconForNode(entry)}
          <span>{entry.name}</span>
        </button>
      ))}
    </div>
  )
}
