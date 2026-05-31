import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'
import { translateMenu } from './menu-i18n'
import type { AppLanguage } from '../shared/types'

type BrowserContextMenuActions = {
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
  copyImageAt: (x: number, y: number) => void
  inspectElement: (x: number, y: number) => void
}

type BrowserContextMenuOptions = BrowserContextMenuActions & {
  params: ContextMenuParams
  language?: AppLanguage
  isDev: boolean
  imageSourceURL?: string
  imageAbsoluteSourceURL?: string
}

export function canOpenExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return ['http:', 'https:', 'mailto:'].includes(parsedUrl.protocol)
  } catch {
    return false
  }
}

export function createBrowserContextMenuItems({
  params,
  language = 'en',
  isDev,
  imageSourceURL,
  imageAbsoluteSourceURL,
  openExternal,
  writeClipboardText,
  copyImageAt,
  inspectElement
}: BrowserContextMenuOptions): MenuItemConstructorOptions[] {
  const t = (key: Parameters<typeof translateMenu>[1]): string => translateMenu(language, key)
  const items: MenuItemConstructorOptions[] = []
  const addSeparator = (): void => {
    if (items.length > 0 && items.at(-1)?.type !== 'separator') {
      items.push({ type: 'separator' })
    }
  }
  const addEditItems = (editItems: MenuItemConstructorOptions[]): void => {
    for (const item of editItems) items.push(item)
  }

  if (params.linkURL) {
    addEditItems([
      {
        label: t('menu.openLink'),
        enabled: canOpenExternalUrl(params.linkURL),
        click: () => openExternal(params.linkURL)
      },
      {
        label: t('menu.copyLinkAddress'),
        click: () => writeClipboardText(params.linkURL)
      }
    ])
    addSeparator()
  }

  if (params.mediaType === 'image' && params.hasImageContents) {
    const copyableImageSourceURL = imageSourceURL ?? params.srcURL

    items.push({
      label: t('menu.copyImage'),
      click: () => copyImageAt(params.x, params.y)
    })

    if (copyableImageSourceURL) {
      items.push({
        label: t('menu.copyImagePath'),
        click: () => writeClipboardText(copyableImageSourceURL)
      })
    }

    if (imageAbsoluteSourceURL) {
      items.push({
        label: t('menu.copyAbsoluteImagePath'),
        click: () => writeClipboardText(imageAbsoluteSourceURL)
      })
    }

    addSeparator()
  }

  if (params.isEditable) {
    addEditItems([
      { role: 'undo', label: t('menu.undo'), enabled: params.editFlags.canUndo },
      { role: 'redo', label: t('menu.redo'), enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', label: t('menu.cut'), enabled: params.editFlags.canCut },
      { role: 'copy', label: t('menu.copy'), enabled: params.editFlags.canCopy },
      { role: 'paste', label: t('menu.paste'), enabled: params.editFlags.canPaste },
      {
        role: 'pasteAndMatchStyle',
        label: t('menu.pasteAndMatchStyle'),
        enabled: params.editFlags.canPaste
      },
      { role: 'delete', label: t('menu.delete'), enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', label: t('menu.selectAll'), enabled: params.editFlags.canSelectAll }
    ])
  } else {
    addEditItems([
      {
        role: 'copy',
        label: t('menu.copy'),
        enabled: params.editFlags.canCopy || params.selectionText.length > 0
      },
      { role: 'selectAll', label: t('menu.selectAll'), enabled: params.editFlags.canSelectAll }
    ])
  }

  if (isDev) {
    addSeparator()
    items.push({
      label: t('menu.inspectElement'),
      click: () => inspectElement(params.x, params.y)
    })
  }

  while (items.at(-1)?.type === 'separator') items.pop()

  return items
}
