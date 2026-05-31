import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import type { AppLanguage } from '../../shared/types'

export type TranslationKey =
  | 'app.openRepository'
  | 'app.settings'
  | 'app.openTabs'
  | 'app.files'
  | 'app.add'
  | 'app.searchFiles'
  | 'app.hideFiles'
  | 'app.showFiles'
  | 'app.back'
  | 'app.forward'
  | 'app.closeWindow'
  | 'app.minimizeWindow'
  | 'app.toggleFullscreen'
  | 'app.unsavedChanges'
  | 'app.unsaved'
  | 'app.discardUnsaved'
  | 'app.closeTab'
  | 'app.showingPath'
  | 'branch.switchBranches'
  | 'branch.closePicker'
  | 'branch.findPlaceholder'
  | 'branch.refs'
  | 'branch.branches'
  | 'branch.remotes'
  | 'branch.current'
  | 'branch.open'
  | 'branch.empty'
  | 'branch.chooseAction'
  | 'branch.closeAction'
  | 'branch.selectedBranch'
  | 'branch.switchPrimary'
  | 'branch.switchPrimaryDescription'
  | 'branch.createWorktree'
  | 'branch.createWorktreeDescription'
  | 'branch.remoteNote'
  | 'common.cancel'
  | 'fileView.label'
  | 'fileView.preview'
  | 'fileView.code'
  | 'fileView.split'
  | 'preview.resizePanels'
  | 'preview.resizeEditorPreview'
  | 'search.currentTab'
  | 'search.find'
  | 'search.previousMatch'
  | 'search.nextMatch'
  | 'search.closeFind'
  | 'globalSearch.dialog'
  | 'globalSearch.close'
  | 'globalSearch.placeholder'
  | 'globalSearch.searching'
  | 'globalSearch.empty'
  | 'globalSearch.noResults'
  | 'globalSearch.path'
  | 'globalSearch.text'
  | 'globalSearch.worktreeSource'
  | 'settings.title'
  | 'settings.close'
  | 'settings.appearance'
  | 'settings.theme'
  | 'settings.themeSystem'
  | 'settings.themeLight'
  | 'settings.themeDark'
  | 'settings.language'
  | 'settings.languageEnglish'
  | 'settings.languageChinese'
  | 'settings.homeFiles'
  | 'settings.candidateOrder'
  | 'settings.preview'
  | 'settings.font'
  | 'settings.fontSize'
  | 'settings.fontSystem'
  | 'settings.fontSans'
  | 'settings.fontSerif'
  | 'settings.fontMono'
  | 'settings.editor'
  | 'settings.indentWith'
  | 'settings.spaces'
  | 'settings.tabs'
  | 'settings.indentSize'
  | 'tree.collapse'
  | 'tree.expand'
  | 'tree.modified'
  | 'status.workspace'
  | 'status.directory'
  | 'status.workingTree'
  | 'status.worktree'
  | 'preview.sourceCode'
  | 'preview.page'
  | 'preview.pdfLabel'
  | 'preview.loadingPdf'
  | 'preview.unavailable'
  | 'preview.pdfUnavailable'
  | 'preview.fileUnavailable'
  | 'preview.image'
  | 'preview.closeImage'
  | 'preview.previousImage'
  | 'preview.nextImage'
  | 'preview.scrollZoom'
  | 'preview.copy'
  | 'preview.copied'
  | 'preview.failed'
  | 'preview.codeCopied'
  | 'preview.copyFailed'
  | 'preview.copyCode'

export type TranslationValues = Record<string, string | number>
export type Translator = (key: TranslationKey, values?: TranslationValues) => string

export const supportedLanguages = ['en', 'zh-CN'] as const satisfies readonly AppLanguage[]

export const messages: Record<AppLanguage, Record<TranslationKey, string>> = {
  en: {
    'app.openRepository': 'Open Repository',
    'app.settings': 'Settings',
    'app.openTabs': 'Open tabs',
    'app.files': 'Files',
    'app.add': 'Add',
    'app.searchFiles': 'Search files',
    'app.hideFiles': 'Hide files',
    'app.showFiles': 'Show files',
    'app.back': 'Back',
    'app.forward': 'Forward',
    'app.closeWindow': 'Close window',
    'app.minimizeWindow': 'Minimize window',
    'app.toggleFullscreen': 'Toggle fullscreen',
    'app.unsavedChanges': 'Unsaved changes',
    'app.unsaved': 'Unsaved',
    'app.discardUnsaved': 'Discard unsaved changes in the current file?',
    'app.closeTab': 'Close {name}',
    'app.showingPath': 'Showing {path}',
    'branch.switchBranches': 'Switch branches',
    'branch.closePicker': 'Close branch picker',
    'branch.findPlaceholder': 'Find a branch...',
    'branch.refs': 'Branch refs',
    'branch.branches': 'Branches',
    'branch.remotes': 'Remotes',
    'branch.current': 'current',
    'branch.open': 'open',
    'branch.empty': 'No branches found',
    'branch.chooseAction': 'Choose action for {name}',
    'branch.closeAction': 'Close branch action',
    'branch.selectedBranch': 'Selected branch',
    'branch.switchPrimary': 'Switch primary workspace from {from} to {to}',
    'branch.switchPrimaryDescription':
      'Changes the primary repository folder to {branch}. Existing worktrees keep their branches.',
    'branch.createWorktree': 'Create git worktree in .worktrees',
    'branch.createWorktreeDescription':
      'Creates or opens an isolated working copy under .worktrees while the current folder keeps its branch.',
    'branch.remoteNote':
      'Remote refs can be opened as worktrees. Switching in place requires a local branch first.',
    'common.cancel': 'Cancel',
    'fileView.label': 'File view',
    'fileView.preview': 'Preview',
    'fileView.code': 'Code',
    'fileView.split': 'Split',
    'preview.resizePanels': 'Resize panels',
    'preview.resizeEditorPreview': 'Resize editor and preview',
    'search.currentTab': 'Find in current tab',
    'search.find': 'Find',
    'search.previousMatch': 'Previous match',
    'search.nextMatch': 'Next match',
    'search.closeFind': 'Close find',
    'globalSearch.dialog': 'Search repository',
    'globalSearch.close': 'Close search',
    'globalSearch.placeholder': 'Search files and content',
    'globalSearch.searching': 'Searching',
    'globalSearch.empty': 'Type to search paths and text in this repository.',
    'globalSearch.noResults': 'No results',
    'globalSearch.path': 'Path',
    'globalSearch.text': 'Text',
    'globalSearch.worktreeSource': '{ref} worktree',
    'settings.title': 'Settings',
    'settings.close': 'Close settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.themeSystem': 'Follow system',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.language': 'Language',
    'settings.languageEnglish': 'English',
    'settings.languageChinese': 'Chinese',
    'settings.homeFiles': 'Home Files',
    'settings.candidateOrder': 'Candidate order',
    'settings.preview': 'Preview',
    'settings.font': 'Font',
    'settings.fontSize': 'Font size',
    'settings.fontSystem': 'System',
    'settings.fontSans': 'Sans',
    'settings.fontSerif': 'Serif',
    'settings.fontMono': 'Mono',
    'settings.editor': 'Editor',
    'settings.indentWith': 'Indent with',
    'settings.spaces': 'Spaces',
    'settings.tabs': 'Tabs',
    'settings.indentSize': 'Indent size',
    'tree.collapse': 'Collapse {name}',
    'tree.expand': 'Expand {name}',
    'tree.modified': 'Modified',
    'status.workspace': 'Workspace status',
    'status.directory': 'Directory',
    'status.workingTree': 'Working tree',
    'status.worktree': 'Worktree',
    'preview.sourceCode': 'Source code',
    'preview.page': 'Page {page}',
    'preview.pdfLabel': 'PDF preview: {name}',
    'preview.loadingPdf': 'Loading PDF',
    'preview.unavailable': 'Preview unavailable',
    'preview.pdfUnavailable': 'This PDF could not be rendered.',
    'preview.fileUnavailable': 'This file type is not rendered yet.',
    'preview.image': 'Image preview',
    'preview.closeImage': 'Close image preview',
    'preview.previousImage': 'Previous image',
    'preview.nextImage': 'Next image',
    'preview.scrollZoom': 'Scroll to zoom. Double-click to toggle zoom.',
    'preview.copy': 'Copy',
    'preview.copied': 'Copied',
    'preview.failed': 'Failed',
    'preview.codeCopied': 'Code copied',
    'preview.copyFailed': 'Copy failed',
    'preview.copyCode': 'Copy code'
  },
  'zh-CN': {
    'app.openRepository': '打开仓库',
    'app.settings': '设置',
    'app.openTabs': '已打开标签',
    'app.files': '文件',
    'app.add': '添加',
    'app.searchFiles': '搜索文件',
    'app.hideFiles': '隐藏文件',
    'app.showFiles': '显示文件',
    'app.back': '后退',
    'app.forward': '前进',
    'app.closeWindow': '关闭窗口',
    'app.minimizeWindow': '最小化窗口',
    'app.toggleFullscreen': '切换全屏',
    'app.unsavedChanges': '未保存的更改',
    'app.unsaved': '未保存',
    'app.discardUnsaved': '放弃当前文件中未保存的更改？',
    'app.closeTab': '关闭 {name}',
    'app.showingPath': '正在显示 {path}',
    'branch.switchBranches': '切换分支',
    'branch.closePicker': '关闭分支选择器',
    'branch.findPlaceholder': '查找分支...',
    'branch.refs': '分支引用',
    'branch.branches': '分支',
    'branch.remotes': '远程',
    'branch.current': '当前',
    'branch.open': '已打开',
    'branch.empty': '未找到分支',
    'branch.chooseAction': '选择 {name} 的操作',
    'branch.closeAction': '关闭分支操作',
    'branch.selectedBranch': '已选分支',
    'branch.switchPrimary': '将主工作区从 {from} 切换到 {to}',
    'branch.switchPrimaryDescription':
      '将主仓库文件夹切换到 {branch}。已有 worktree 会保留各自分支。',
    'branch.createWorktree': '在 .worktrees 中创建 git worktree',
    'branch.createWorktreeDescription':
      '在 .worktrees 下创建或打开隔离工作副本，当前文件夹保持原分支。',
    'branch.remoteNote': '远程引用可以作为 worktree 打开。原地切换需要先创建本地分支。',
    'common.cancel': '取消',
    'fileView.label': '文件视图',
    'fileView.preview': '预览',
    'fileView.code': '代码',
    'fileView.split': '分栏',
    'preview.resizePanels': '调整面板大小',
    'preview.resizeEditorPreview': '调整编辑器和预览大小',
    'search.currentTab': '在当前标签中查找',
    'search.find': '查找',
    'search.previousMatch': '上一个匹配',
    'search.nextMatch': '下一个匹配',
    'search.closeFind': '关闭查找',
    'globalSearch.dialog': '搜索仓库',
    'globalSearch.close': '关闭搜索',
    'globalSearch.placeholder': '搜索文件和内容',
    'globalSearch.searching': '正在搜索',
    'globalSearch.empty': '输入内容以搜索此仓库中的路径和文本。',
    'globalSearch.noResults': '无结果',
    'globalSearch.path': '路径',
    'globalSearch.text': '文本',
    'globalSearch.worktreeSource': '{ref} worktree',
    'settings.title': '设置',
    'settings.close': '关闭设置',
    'settings.appearance': '外观',
    'settings.theme': '主题',
    'settings.themeSystem': '跟随系统',
    'settings.themeLight': '浅色',
    'settings.themeDark': '深色',
    'settings.language': '语言',
    'settings.languageEnglish': '英文',
    'settings.languageChinese': '中文',
    'settings.homeFiles': '主页文件',
    'settings.candidateOrder': '候选顺序',
    'settings.preview': '预览',
    'settings.font': '字体',
    'settings.fontSize': '字号',
    'settings.fontSystem': '系统',
    'settings.fontSans': '无衬线',
    'settings.fontSerif': '衬线',
    'settings.fontMono': '等宽',
    'settings.editor': '编辑器',
    'settings.indentWith': '缩进方式',
    'settings.spaces': '空格',
    'settings.tabs': '制表符',
    'settings.indentSize': '缩进大小',
    'tree.collapse': '折叠 {name}',
    'tree.expand': '展开 {name}',
    'tree.modified': '已修改',
    'status.workspace': '工作区状态',
    'status.directory': '目录',
    'status.workingTree': '工作树',
    'status.worktree': 'Worktree',
    'preview.sourceCode': '源代码',
    'preview.page': '第 {page} 页',
    'preview.pdfLabel': 'PDF 预览：{name}',
    'preview.loadingPdf': '正在加载 PDF',
    'preview.unavailable': '预览不可用',
    'preview.pdfUnavailable': '无法渲染此 PDF。',
    'preview.fileUnavailable': '暂不支持渲染此文件类型。',
    'preview.image': '图片预览',
    'preview.closeImage': '关闭图片预览',
    'preview.previousImage': '上一张图片',
    'preview.nextImage': '下一张图片',
    'preview.scrollZoom': '滚动缩放。双击切换缩放。',
    'preview.copy': '复制',
    'preview.copied': '已复制',
    'preview.failed': '失败',
    'preview.codeCopied': '代码已复制',
    'preview.copyFailed': '复制失败',
    'preview.copyCode': '复制代码'
  }
}

export const i18n = i18next.createInstance()

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: messages.en },
    'zh-CN': { translation: messages['zh-CN'] }
  },
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...supportedLanguages],
  interpolation: {
    escapeValue: false,
    prefix: '{',
    suffix: '}'
  },
  keySeparator: false,
  initAsync: false,
  react: {
    useSuspense: false
  }
})

export function changeAppLanguage(language: AppLanguage): void {
  void i18n.changeLanguage(language)
}

export function createTranslator(language: AppLanguage): Translator {
  const fixedT = i18n.getFixedT(language)

  return (key, values = {}) => {
    return String(fixedT(key, values))
  }
}
