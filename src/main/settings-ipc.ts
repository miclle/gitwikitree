import type { IpcMain } from 'electron'
import type { AppSettings } from '../shared/types'

type SettingsIpcDependencies = {
  ipcMain: Pick<IpcMain, 'handle'>
  readSettings: () => Promise<AppSettings>
  writeSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  applySettings: (settings: AppSettings) => void
}

export function registerSettingsIpcHandlers({
  ipcMain,
  readSettings,
  writeSettings,
  applySettings
}: SettingsIpcDependencies): void {
  ipcMain.handle('settings:get', () => readSettings())

  ipcMain.handle('settings:save', async (_event, settings: Partial<AppSettings>) => {
    const nextSettings = await writeSettings(settings)
    applySettings(nextSettings)
    return nextSettings
  })
}
