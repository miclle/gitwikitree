import type { MenuItemConstructorOptions, WebContents } from 'electron'
import type {
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  TreeItemOpenPayload
} from '../shared/types'
import { canOpenExternalUrl } from './browser-context-menu'

export type TreeItemContext = TreeItemOpenPayload
export type MarkdownLinkContextMenuItem = MarkdownLinkContext

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

export function createMarkdownLinkContextMenuItems({
  item,
  sender,
  openExternal,
  writeClipboardText,
  openInNewWindow
}: {
  item: MarkdownLinkContextMenuItem
  sender: Pick<WebContents, 'send'>
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
  openInNewWindow: (item: TreeItemContext) => void
}): MenuItemConstructorOptions[] {
  const copyLinkItem: MenuItemConstructorOptions = {
    label: 'Copy Link Address',
    click: () => writeClipboardText(item.href)
  }

  if (item.kind === 'unresolved') {
    return [copyLinkItem]
  }

  if (item.kind === 'external') {
    const canOpen = canOpenExternalUrl(item.href)

    return [
      {
        label: 'Open Link',
        enabled: canOpen,
        click: () => {
          if (canOpen) openExternal(item.href)
        }
      },
      copyLinkItem
    ]
  }

  const sendOpen = (action: MarkdownLinkOpenPayload['action']): void => {
    sender.send('markdown-link:open', { ...item, action })
  }
  const openLinkInNewWindow = (): void => {
    if (!item.repoPath || item.targetPath === undefined) return

    openInNewWindow({
      repoPath: item.repoPath,
      rootPath: item.rootPath,
      activeRef: item.activeRef,
      source: item.source,
      path: item.targetPath,
      name: item.targetName ?? item.targetPath.split('/').filter(Boolean).at(-1) ?? item.targetPath,
      type: item.targetType ?? 'file',
      anchor: item.hash
    })
  }

  return [
    {
      label: 'Open Link',
      click: () => sendOpen('open')
    },
    {
      label: 'Open in New Tab',
      click: () => sendOpen('open-new-tab')
    },
    {
      label: 'Open in New Window',
      click: openLinkInNewWindow
    },
    { type: 'separator' },
    copyLinkItem
  ]
}
