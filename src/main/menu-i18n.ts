import type { AppLanguage } from '../shared/types'

export type MenuTranslationKey =
  | 'menu.noRecentProjects'
  | 'menu.recentProjects'
  | 'menu.recentFiles'
  | 'menu.noRecentFiles'
  | 'menu.clearRecent'
  | 'menu.settings'
  | 'menu.file'
  | 'menu.openRepository'
  | 'menu.save'
  | 'menu.closeTab'
  | 'menu.closeWindow'
  | 'menu.edit'
  | 'menu.undo'
  | 'menu.redo'
  | 'menu.cut'
  | 'menu.copy'
  | 'menu.paste'
  | 'menu.pasteAndMatchStyle'
  | 'menu.delete'
  | 'menu.selectAll'
  | 'menu.find'
  | 'menu.searchRepository'
  | 'menu.navigate'
  | 'menu.selectTab'
  | 'menu.selectLastTab'
  | 'menu.view'
  | 'menu.reload'
  | 'menu.toggleDeveloperTools'
  | 'menu.resetZoom'
  | 'menu.openLink'
  | 'menu.copyLinkAddress'
  | 'menu.openInNewTab'
  | 'menu.openInNewWindow'
  | 'menu.copyImage'
  | 'menu.copyImagePath'
  | 'menu.copyAbsoluteImagePath'
  | 'menu.inspectElement'

const menuMessages: Record<AppLanguage, Record<MenuTranslationKey, string>> = {
  en: {
    'menu.noRecentProjects': 'No Recent Projects',
    'menu.recentProjects': 'Recent Projects',
    'menu.recentFiles': 'Recent Files',
    'menu.noRecentFiles': 'No Recent Files',
    'menu.clearRecent': 'Clear Recent...',
    'menu.settings': 'Settings...',
    'menu.file': 'File',
    'menu.openRepository': 'Open Repository...',
    'menu.save': 'Save',
    'menu.closeTab': 'Close Tab',
    'menu.closeWindow': 'Close Window',
    'menu.edit': 'Edit',
    'menu.undo': 'Undo',
    'menu.redo': 'Redo',
    'menu.cut': 'Cut',
    'menu.copy': 'Copy',
    'menu.paste': 'Paste',
    'menu.pasteAndMatchStyle': 'Paste and Match Style',
    'menu.delete': 'Delete',
    'menu.selectAll': 'Select All',
    'menu.find': 'Find',
    'menu.searchRepository': 'Search Repository...',
    'menu.navigate': 'Navigate',
    'menu.selectTab': 'Select Tab',
    'menu.selectLastTab': 'Select Last Tab',
    'menu.view': 'View',
    'menu.reload': 'Reload',
    'menu.toggleDeveloperTools': 'Toggle Developer Tools',
    'menu.resetZoom': 'Reset Zoom',
    'menu.openLink': 'Open Link',
    'menu.copyLinkAddress': 'Copy Link Address',
    'menu.openInNewTab': 'Open in New Tab',
    'menu.openInNewWindow': 'Open in New Window',
    'menu.copyImage': 'Copy Image',
    'menu.copyImagePath': 'Copy Image Path',
    'menu.copyAbsoluteImagePath': 'Copy Absolute Image Path',
    'menu.inspectElement': 'Inspect Element'
  },
  'zh-CN': {
    'menu.noRecentProjects': '无最近项目',
    'menu.recentProjects': '最近项目',
    'menu.recentFiles': '最近文件',
    'menu.noRecentFiles': '无最近文件',
    'menu.clearRecent': '清除最近打开...',
    'menu.settings': '设置...',
    'menu.file': '文件',
    'menu.openRepository': '打开仓库...',
    'menu.save': '保存',
    'menu.closeTab': '关闭标签',
    'menu.closeWindow': '关闭窗口',
    'menu.edit': '编辑',
    'menu.undo': '撤销',
    'menu.redo': '重做',
    'menu.cut': '剪切',
    'menu.copy': '复制',
    'menu.paste': '粘贴',
    'menu.pasteAndMatchStyle': '粘贴并匹配样式',
    'menu.delete': '删除',
    'menu.selectAll': '全选',
    'menu.find': '查找',
    'menu.searchRepository': '搜索仓库...',
    'menu.navigate': '导航',
    'menu.selectTab': '选择标签',
    'menu.selectLastTab': '选择最后一个标签',
    'menu.view': '视图',
    'menu.reload': '重新加载',
    'menu.toggleDeveloperTools': '切换开发者工具',
    'menu.resetZoom': '重置缩放',
    'menu.openLink': '打开链接',
    'menu.copyLinkAddress': '复制链接地址',
    'menu.openInNewTab': '在新标签中打开',
    'menu.openInNewWindow': '在新窗口中打开',
    'menu.copyImage': '复制图片',
    'menu.copyImagePath': '复制图片路径',
    'menu.copyAbsoluteImagePath': '复制绝对图片路径',
    'menu.inspectElement': '检查元素'
  }
}

export function translateMenu(language: AppLanguage, key: MenuTranslationKey): string {
  return menuMessages[language][key] ?? menuMessages.en[key]
}
