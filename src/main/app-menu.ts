import type { MenuItemConstructorOptions } from 'electron'
import { basename } from 'path'
import { translateMenu } from './menu-i18n'
import { getRecentRepositories } from './session-store'
import type { AppLanguage, RecentFileState, RecentRepositoryState } from '../shared/types'

export type MenuClickEvent = Parameters<NonNullable<MenuItemConstructorOptions['click']>>[2]

type AppMenuTemplateOptions = {
  appName: string
  platform: NodeJS.Platform
  language?: AppLanguage
  recentRepositories: RecentRepositoryState[]
  recentFiles: RecentFileState[]
  openRepository: () => void
  openRecentRepository: (repoPath: string, event: MenuClickEvent) => void
  openRecentFile: (file: RecentFileState, event: MenuClickEvent) => void
  clearRecent: () => void
  closeCurrentTabOrWindow: () => void
  saveCurrentFile: () => void
  openSettings: () => void
  openCurrentTabSearch: () => void
  openGlobalSearch: () => void
  closeWindow: () => void
}

export function createAppMenuTemplate({
  appName,
  platform,
  language = 'en',
  recentRepositories,
  recentFiles,
  openRepository,
  openRecentRepository,
  openRecentFile,
  clearRecent,
  closeCurrentTabOrWindow,
  saveCurrentFile,
  openSettings,
  openCurrentTabSearch,
  openGlobalSearch,
  closeWindow
}: AppMenuTemplateOptions): MenuItemConstructorOptions[] {
  const t = (key: Parameters<typeof translateMenu>[1]): string => translateMenu(language, key)
  const recentRepositoryItems: MenuItemConstructorOptions[] =
    recentRepositories.length > 0 || recentFiles.length > 0
      ? getRecentRepositories(recentRepositories, recentFiles).map((repoPath) => ({
          label: `${basename(repoPath)} - ${repoPath}`,
          click: (_menuItem, _window, event) => openRecentRepository(repoPath, event)
        }))
      : [{ label: t('menu.noRecentProjects'), enabled: false }]

  const recentFileItems: MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? recentFiles.map((file) => ({
          label: `${file.name} - ${file.repoPath}`,
          click: (_menuItem, _window, event) => openRecentFile(file, event)
        }))
      : [{ label: t('menu.noRecentFiles'), enabled: false }]

  const recentItems: MenuItemConstructorOptions[] = [
    { label: t('menu.recentProjects'), enabled: false },
    ...recentRepositoryItems,
    { type: 'separator' },
    { label: t('menu.recentFiles'), enabled: false },
    ...recentFileItems,
    { type: 'separator' },
    {
      label: t('menu.clearRecent'),
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
              {
                label: t('menu.settings'),
                accelerator: 'CommandOrControl+,',
                click: openSettings
              },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: t('menu.file'),
      submenu: [
        {
          label: t('menu.openRepository'),
          accelerator: 'CommandOrControl+O',
          click: () => openRepository()
        },
        {
          label: t('menu.recentFiles'),
          submenu: recentItems
        },
        { type: 'separator' },
        {
          label: t('menu.save'),
          accelerator: 'CommandOrControl+S',
          click: saveCurrentFile
        },
        {
          label: t('menu.closeTab'),
          accelerator: 'CommandOrControl+W',
          click: closeCurrentTabOrWindow
        },
        {
          label: t('menu.closeWindow'),
          accelerator: 'Shift+CommandOrControl+W',
          click: closeWindow
        }
      ]
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'pasteAndMatchStyle', label: t('menu.pasteAndMatchStyle') },
        { role: 'delete', label: t('menu.delete') },
        { type: 'separator' },
        {
          label: t('menu.find'),
          accelerator: 'CommandOrControl+F',
          click: openCurrentTabSearch
        },
        {
          label: t('menu.searchRepository'),
          accelerator: 'Shift+CommandOrControl+F',
          click: openGlobalSearch
        },
        { type: 'separator' },
        {
          label: t('menu.settings'),
          accelerator: 'CommandOrControl+,',
          visible: platform !== 'darwin',
          click: openSettings
        },
        { role: 'selectAll', label: t('menu.selectAll') }
      ]
    },
    {
      label: t('menu.view'),
      submenu: [
        { role: 'reload', label: t('menu.reload') },
        { role: 'toggleDevTools', label: t('menu.toggleDeveloperTools') },
        { type: 'separator' },
        { role: 'resetZoom', label: t('menu.resetZoom') }
      ]
    }
  ]
}
