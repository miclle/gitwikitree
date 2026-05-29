import type {
  BrowserWindow,
  IpcMain,
  IpcMainInvokeEvent,
  MenuItemConstructorOptions,
  WebContents
} from 'electron'
import { createTreeItemContextMenuItems, type TreeItemContext } from './context-menu'

type MenuLike = {
  popup: (options: { window: BrowserWindow }) => void
}

type ContextMenuIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  getWindowFromWebContents: (webContents: IpcMainInvokeEvent['sender']) => BrowserWindow | null
  buildMenuFromTemplate: (items: MenuItemConstructorOptions[]) => MenuLike
  openTreeItemInNewWindow: (item: TreeItemContext) => void
}

export function registerContextMenuIpcHandlers({
  ipcMain,
  getWindowFromWebContents,
  buildMenuFromTemplate,
  openTreeItemInNewWindow
}: ContextMenuIpcDependencies): void {
  ipcMain.handle('context-menu:tree-item', (event, item: TreeItemContext) => {
    const targetWindow = getWindowFromWebContents(event.sender)
    if (!targetWindow) return

    const menuItems = createTreeItemContextMenuItems({
      item,
      sender: event.sender as Pick<WebContents, 'send'>,
      openInNewWindow: openTreeItemInNewWindow
    })

    buildMenuFromTemplate(menuItems).popup({ window: targetWindow })
  })
}
