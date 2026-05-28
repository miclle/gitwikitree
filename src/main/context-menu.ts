import type { MenuItemConstructorOptions, WebContents } from 'electron'
import type { TreeItemOpenPayload } from '../shared/types'

export type TreeItemContext = TreeItemOpenPayload

export function createTreeItemContextMenuItems({
  item,
  sender,
  openInNewWindow
}: {
  item: TreeItemContext
  sender: Pick<WebContents, 'send'>
  openInNewWindow: (item: TreeItemContext) => void
}): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Open in New Tab',
      click: () => sender.send('tree-item:open-in-new-tab', item.path)
    },
    {
      label: 'Open in New Window',
      click: () => openInNewWindow(item)
    }
  ]
}
