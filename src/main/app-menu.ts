import type { MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import { getRecentRepositories } from './session-store'
import type { RecentFileState, RecentRepositoryState } from '../shared/types'

export type MenuClickEvent = Parameters<NonNullable<MenuItemConstructorOptions['click']>>[2]

type AppMenuTemplateOptions = {
  appName: string
  platform: NodeJS.Platform
  recentRepositories: RecentRepositoryState[]
  recentFiles: RecentFileState[]
  openRepository: () => void
  openRecentRepository: (repoPath: string, event: MenuClickEvent) => void
  openRecentFile: (file: RecentFileState, event: MenuClickEvent) => void
  clearRecent: () => void
  closeCurrentTabOrWindow: () => void
  closeWindow: () => void
}

export function createAppMenuTemplate({
  appName,
  platform,
  recentRepositories,
  recentFiles,
  openRepository,
  openRecentRepository,
  openRecentFile,
  clearRecent,
  closeCurrentTabOrWindow,
  closeWindow
}: AppMenuTemplateOptions): MenuItemConstructorOptions[] {
  const recentRepositoryItems: MenuItemConstructorOptions[] =
    recentRepositories.length > 0 || recentFiles.length > 0
      ? getRecentRepositories(recentRepositories, recentFiles).map((repoPath) => ({
          label: `${basename(repoPath)} - ${repoPath}`,
          click: (_menuItem, _window, event) => openRecentRepository(repoPath, event)
        }))
      : [{ label: 'No Recent Projects', enabled: false }]

  const recentFileItems: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? recentFiles.map((file) => ({
          label: `${file.name} - ${file.repoPath}`,
          click: (_menuItem, _window, event) => openRecentFile(file, event)
        }))
      : [{ label: 'No Recent Files', enabled: false }]

  const recentItems: MenuItemConstructorOptions[] = [
    { label: '最近打开的项目', enabled: false },
    ...recentRepositoryItems,
    { type: 'separator' },
    { label: 'Recent Files', enabled: false },
    ...recentFileItems,
    { type: 'separator' },
    {
      label: '清除最近打开...',
      enabled: recentRepositories.length > 0 || recentFiles.length > 0,
      click: () => clearRecent()
    }
  ]

  return [
    ...(platform === 'darwin'
      ? [
          {
            label: appName,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Repository...',
          accelerator: 'CommandOrControl+O',
          click: () => openRepository()
        },
        {
          label: 'Recent Files',
          submenu: recentItems
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CommandOrControl+W',
          click: closeCurrentTabOrWindow
        },
        {
          label: 'Close Window',
          accelerator: 'Shift+CommandOrControl+W',
          click: closeWindow
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }
      ]
    }
  ]
}
