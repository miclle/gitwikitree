import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'

type BrowserContextMenuActions = {
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
  copyImageAt: (x: number, y: number) => void
  inspectElement: (x: number, y: number) => void
}

type BrowserContextMenuOptions = BrowserContextMenuActions & {
  params: ContextMenuParams
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
  isDev,
  imageSourceURL,
  imageAbsoluteSourceURL,
  openExternal,
  writeClipboardText,
  copyImageAt,
  inspectElement
}: BrowserContextMenuOptions): MenuItemConstructorOptions[] {
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
        label: 'Open Link',
        enabled: canOpenExternalUrl(params.linkURL),
        click: () => openExternal(params.linkURL)
      },
      {
        label: 'Copy Link Address',
        click: () => writeClipboardText(params.linkURL)
      }
    ])
    addSeparator()
  }

  if (params.mediaType === 'image' && params.hasImageContents) {
    const copyableImageSourceURL = imageSourceURL ?? params.srcURL

    items.push({
      label: 'Copy Image',
      click: () => copyImageAt(params.x, params.y)
    })

    if (copyableImageSourceURL) {
      items.push({
        label: 'Copy Image Path',
        click: () => writeClipboardText(copyableImageSourceURL)
      })
    }

    if (imageAbsoluteSourceURL) {
      items.push({
        label: 'Copy Absolute Image Path',
        click: () => writeClipboardText(imageAbsoluteSourceURL)
      })
    }

    addSeparator()
  }

  if (params.isEditable) {
    addEditItems([
      { role: 'undo', enabled: params.editFlags.canUndo },
      { role: 'redo', enabled: params.editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { role: 'pasteAndMatchStyle', enabled: params.editFlags.canPaste },
      { role: 'delete', enabled: params.editFlags.canDelete },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ])
  } else {
    addEditItems([
      { role: 'copy', enabled: params.editFlags.canCopy || params.selectionText.length > 0 },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    ])
  }

  if (isDev) {
    addSeparator()
    items.push({
      label: 'Inspect Element',
      click: () => inspectElement(params.x, params.y)
    })
  }

  while (items.at(-1)?.type === 'separator') items.pop()

  return items
}
