import type {
  BrowserWindow,
  IpcMain,
  IpcMainInvokeEvent,
  MenuItemConstructorOptions,
  WebContents
} from 'electron'
import type { AppLanguage, MarkdownLinkContext } from '../shared/types'
import {
  createMarkdownLinkContextMenuItems,
  createTreeItemContextMenuItems,
  type TreeItemContext
} from './context-menu'

type MenuLike = {
  popup: (options: { window: BrowserWindow }) => void
}

type ContextMenuIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  getWindowFromWebContents: (webContents: IpcMainInvokeEvent['sender']) => BrowserWindow | null
  buildMenuFromTemplate: (items: MenuItemConstructorOptions[]) => MenuLike
  openTreeItemInNewWindow: (item: TreeItemContext) => void
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
  getLanguage: () => AppLanguage
}

export function registerContextMenuIpcHandlers({
  ipcMain,
  getWindowFromWebContents,
  buildMenuFromTemplate,
  openTreeItemInNewWindow,
  openExternal,
  writeClipboardText,
  getLanguage
}: ContextMenuIpcDependencies): void {
  ipcMain.handle('context-menu:tree-item', (event, item: TreeItemContext) => {
    const targetWindow = getWindowFromWebContents(event.sender)
    if (!targetWindow) return

    const menuItems = createTreeItemContextMenuItems({
      item,
      language: getLanguage(),
      sender: event.sender as Pick<WebContents, 'send'>,
      openInNewWindow: openTreeItemInNewWindow
    })

    buildMenuFromTemplate(menuItems).popup({ window: targetWindow })
  })

  ipcMain.handle('context-menu:markdown-link', (event, item: MarkdownLinkContext) => {
    const targetWindow = getWindowFromWebContents(event.sender)
    if (!targetWindow) return

    const menuItems = createMarkdownLinkContextMenuItems({
      item,
      language: getLanguage(),
      sender: event.sender as Pick<WebContents, 'send'>,
      openExternal,
      writeClipboardText,
      openInNewWindow: openTreeItemInNewWindow
    })

    buildMenuFromTemplate(menuItems).popup({ window: targetWindow })
  })
}
