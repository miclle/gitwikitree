import type { BrowserWindow, IpcMain, IpcMainInvokeEvent } from 'electron'

type WindowControlAction = 'close' | 'minimize' | 'toggle-maximize'

type WindowIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  createWindow: () => void
  getWindowFromWebContents: (webContents: IpcMainInvokeEvent['sender']) => BrowserWindow | null
}

export function registerWindowIpcHandlers({
  ipcMain,
  createWindow,
  getWindowFromWebContents
}: WindowIpcDependencies): void {
  ipcMain.handle('window:new', () => createWindow())

  ipcMain.handle('window:control', (event, action: WindowControlAction) => {
    const browserWindow = getWindowFromWebContents(event.sender)
    if (!browserWindow) return

    if (action === 'close') {
      browserWindow.close()
      return
    }

    if (action === 'minimize') {
      browserWindow.minimize()
      return
    }

    if (browserWindow.isMaximized()) {
      browserWindow.unmaximize()
    } else {
      browserWindow.maximize()
    }
  })
}
