import type { App, BrowserWindow, Dialog, MessageBoxOptions } from 'electron'
import type { AppUpdater } from 'electron-updater'
import type { AppLanguage } from '../shared/types'

type Logger = Pick<Console, 'warn'>
type AutoUpdatePromptMessages = {
  restart: string
  later: string
  title: string
  message: string
}

const autoUpdateMessages: Record<AppLanguage, AutoUpdatePromptMessages> = {
  en: {
    restart: 'Restart',
    later: 'Later',
    title: 'Update ready',
    message: 'A new version has been downloaded. Restart Git Wikitree to finish installing it.'
  },
  'zh-CN': {
    restart: '重启',
    later: '稍后',
    title: '更新已就绪',
    message: '新版本已下载。重启 Git Wikitree 后将完成安装。'
  }
}

export interface AutoUpdateDependencies {
  app: Pick<App, 'isPackaged'>
  autoUpdater: Pick<AppUpdater, 'autoDownload' | 'checkForUpdates' | 'on' | 'quitAndInstall'> & {
    channel?: string | null
  }
  dialog: Pick<Dialog, 'showMessageBox'>
  getFocusedWindow: () => BrowserWindow | null
  channel?: string
  language?: AppLanguage
  logger?: Logger
}

type CheckForUpdatesDependencies = Pick<AutoUpdateDependencies, 'app' | 'autoUpdater' | 'logger'>

export function getAutoUpdateChannel(
  platform = process.platform,
  arch = process.arch
): string | undefined {
  if (platform !== 'darwin') return undefined

  return arch === 'arm64' ? 'latest-arm64' : 'latest-x64'
}

export function checkForUpdates({
  app,
  autoUpdater,
  logger = console
}: CheckForUpdatesDependencies): void {
  if (!app.isPackaged) return

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    logger.warn('Failed to check for updates', error)
  })
}

export function configureAutoUpdates({
  app,
  autoUpdater,
  dialog,
  getFocusedWindow,
  channel,
  language = 'en',
  logger = console
}: AutoUpdateDependencies): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  if (channel) autoUpdater.channel = channel

  autoUpdater.on('update-downloaded', async () => {
    const targetWindow = getFocusedWindow()
    const messages = autoUpdateMessages[language] ?? autoUpdateMessages.en
    const messageBoxOptions: MessageBoxOptions = {
      type: 'info',
      buttons: [messages.restart, messages.later],
      defaultId: 0,
      cancelId: 1,
      title: messages.title,
      message: messages.message
    }
    const { response } = targetWindow
      ? await dialog.showMessageBox(targetWindow, messageBoxOptions)
      : await dialog.showMessageBox(messageBoxOptions)

    if (response === 0) autoUpdater.quitAndInstall()
  })

  checkForUpdates({ app, autoUpdater, logger })
}
