import type { MenuItemConstructorOptions, WebContents } from 'electron'
import { translateMenu } from './menu-i18n'
import type {
  AppLanguage,
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  TreeItemOpenPayload
} from '../shared/types'
import { canOpenExternalUrl } from './browser-context-menu'

export type TreeItemContext = TreeItemOpenPayload
export type MarkdownLinkContextMenuItem = MarkdownLinkContext

export function createTreeItemContextMenuItems({
  item,
  language = 'en',
  sender,
  openInNewWindow
}: {
  item: TreeItemContext
  language?: AppLanguage
  sender: Pick<WebContents, 'send'>
  openInNewWindow: (item: TreeItemContext) => void
}): MenuItemConstructorOptions[] {
  const t = (key: Parameters<typeof translateMenu>[1]): string => translateMenu(language, key)

  return [
    {
      label: t('menu.openInNewTab'),
      click: () => sender.send('tree-item:open-in-new-tab', item.path)
    },
    {
      label: t('menu.openInNewWindow'),
      click: () => openInNewWindow(item)
    }
  ]
}

export function createMarkdownLinkContextMenuItems({
  item,
  language = 'en',
  sender,
  openExternal,
  writeClipboardText,
  openInNewWindow
}: {
  item: MarkdownLinkContextMenuItem
  language?: AppLanguage
  sender: Pick<WebContents, 'send'>
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
  openInNewWindow: (item: TreeItemContext) => void
}): MenuItemConstructorOptions[] {
  const t = (key: Parameters<typeof translateMenu>[1]): string => translateMenu(language, key)
  const copyLinkItem: MenuItemConstructorOptions = {
    label: t('menu.copyLinkAddress'),
    click: () => writeClipboardText(item.href)
  }

  if (item.kind === 'unresolved') {
    return [copyLinkItem]
  }

  if (item.kind === 'external') {
    const canOpen = canOpenExternalUrl(item.href)

    return [
      {
        label: t('menu.openLink'),
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
      label: t('menu.openLink'),
      click: () => sendOpen('open')
    },
    {
      label: t('menu.openInNewTab'),
      click: () => sendOpen('open-new-tab')
    },
    {
      label: t('menu.openInNewWindow'),
      click: openLinkInNewWindow
    },
    { type: 'separator' },
    copyLinkItem
  ]
}
