/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAppMenu() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/app-menu.ts',
    modules: [
      'src/main/app-menu.ts',
      'src/main/menu-i18n.ts',
      'src/main/session-store.ts',
      'src/shared/types.ts'
    ]
  })
  return module
}

function createActions() {
  const calls = []

  return {
    calls,
    actions: {
      openRepository: () => calls.push(['openRepository']),
      openRecentRepository: (repoPath, event) =>
        calls.push(['openRecentRepository', repoPath, event]),
      openRecentFile: (file, event) => calls.push(['openRecentFile', file.filePath, event]),
      clearRecent: () => calls.push(['clearRecent']),
      closeCurrentTabOrWindow: () => calls.push(['closeCurrentTabOrWindow']),
      selectAdjacentFileTab: (delta) => calls.push(['selectAdjacentFileTab', delta]),
      saveCurrentFile: () => calls.push(['saveCurrentFile']),
      openSettings: () => calls.push(['openSettings']),
      openCurrentTabSearch: () => calls.push(['openCurrentTabSearch']),
      openGlobalSearch: () => calls.push(['openGlobalSearch']),
      toggleFilesTreeSidebar: () => calls.push(['toggleFilesTreeSidebar']),
      closeWindow: () => calls.push(['closeWindow'])
    }
  }
}

test('createAppMenuTemplate builds file menu actions for recent repositories and files', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions, calls } = createActions()
  const recentFile = {
    repoPath: '/repo',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z'
  }
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [{ repoPath: '/repo', name: 'repo', openedAt: recentFile.openedAt }],
    recentFiles: [recentFile],
    ...actions
  })
  const fileMenu = template.find((item) => item.label === 'File')
  const recentMenu = fileMenu.submenu.find((item) => item.label === 'Recent Files')
  const event = { metaKey: true }

  fileMenu.submenu[0].click()
  recentMenu.submenu[1].click(undefined, undefined, event)
  recentMenu.submenu[4].click(undefined, undefined, event)
  fileMenu.submenu[3].click()
  fileMenu.submenu[4].click()
  template.find((item) => item.label === 'Edit').submenu[9].click()
  template.find((item) => item.label === 'Edit').submenu[10].click()

  assert.deepEqual(
    recentMenu.submenu.map((item) => item.label ?? item.type),
    [
      'Recent Projects',
      'repo - /repo',
      'separator',
      'Recent Files',
      'README.md - /repo',
      'separator',
      'Clear Recent...'
    ]
  )
  assert.deepEqual(calls, [
    ['openRepository'],
    ['openRecentRepository', '/repo', event],
    ['openRecentFile', 'README.md', event],
    ['saveCurrentFile'],
    ['closeCurrentTabOrWindow'],
    ['openCurrentTabSearch'],
    ['openGlobalSearch']
  ])
})

test('createAppMenuTemplate exposes current-tab and repository search menu items', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const editMenu = template.find((item) => item.label === 'Edit')

  assert.deepEqual(
    editMenu.submenu.map((item) => item.label ?? item.role ?? item.type),
    [
      'Undo',
      'Redo',
      'separator',
      'Cut',
      'Copy',
      'Paste',
      'Paste and Match Style',
      'Delete',
      'separator',
      'Find',
      'Search Repository...',
      'separator',
      'Settings...',
      'Select All'
    ]
  )
  assert.deepEqual(
    editMenu.submenu
      .filter((item) => item.label === 'Find' || item.label === 'Search Repository...')
      .map((item) => [item.label, item.accelerator]),
    [
      ['Find', 'CommandOrControl+F'],
      ['Search Repository...', 'Shift+CommandOrControl+F']
    ]
  )
})

test('createAppMenuTemplate exposes Chrome-style tab menu actions', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions, calls } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const tabMenu = template.find((item) => item.label === 'Tab')

  assert.deepEqual(
    tabMenu.submenu.map((item) => [item.label ?? item.type, item.accelerator]),
    [
      ['Select Previous Tab', 'CommandOrControl+Shift+['],
      ['Select Next Tab', 'CommandOrControl+Shift+]']
    ]
  )

  tabMenu.submenu[0].click()
  tabMenu.submenu[1].click()

  assert.deepEqual(calls, [
    ['selectAdjacentFileTab', -1],
    ['selectAdjacentFileTab', 1]
  ])
})

test('createAppMenuTemplate exposes Files Tree sidebar toggle in the view menu', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions, calls } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const viewMenu = template.find((item) => item.label === 'View')
  const toggleItem = viewMenu.submenu.find((item) => item.label === 'Toggle Files Tree')

  assert.equal(toggleItem.accelerator, 'CommandOrControl+B')

  toggleItem.click()

  assert.deepEqual(calls, [['toggleFilesTreeSidebar']])
})

test('createAppMenuTemplate exposes save in the file menu', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const fileMenu = template.find((item) => item.label === 'File')
  const saveItem = fileMenu.submenu.find((item) => item.label === 'Save')

  assert.equal(saveItem.accelerator, 'CommandOrControl+S')
})

test('createAppMenuTemplate exposes settings from the app menu on macOS', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions, calls } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'darwin',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const appMenu = template.find((item) => item.label === 'Git Wikitree')
  const settingsItem = appMenu.submenu.find((item) => item.label === 'Settings...')

  assert.equal(settingsItem.accelerator, 'CommandOrControl+,')
  settingsItem.click()
  assert.deepEqual(calls, [['openSettings']])
})

test('createAppMenuTemplate exposes settings from the edit menu off macOS', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions, calls } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const editMenu = template.find((item) => item.label === 'Edit')
  const settingsItem = editMenu.submenu.find((item) => item.label === 'Settings...')

  assert.equal(settingsItem.accelerator, 'CommandOrControl+,')
  settingsItem.click()
  assert.deepEqual(calls, [['openSettings']])
})

test('createAppMenuTemplate disables empty recent menus and adds darwin app menu', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'darwin',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })

  assert.equal(template[0].label, 'Git Wikitree')
  const fileMenu = template.find((item) => item.label === 'File')
  const recentMenu = fileMenu.submenu.find((item) => item.label === 'Recent Files')

  assert.deepEqual(
    recentMenu.submenu.map((item) => ({ label: item.label, enabled: item.enabled })),
    [
      { label: 'Recent Projects', enabled: false },
      { label: 'No Recent Projects', enabled: false },
      { label: undefined, enabled: undefined },
      { label: 'Recent Files', enabled: false },
      { label: 'No Recent Files', enabled: false },
      { label: undefined, enabled: undefined },
      { label: 'Clear Recent...', enabled: false }
    ]
  )
})

test('createAppMenuTemplate localizes app menu labels', async () => {
  const { createAppMenuTemplate } = await loadAppMenu()
  const { actions } = createActions()
  const template = createAppMenuTemplate({
    appName: 'Git Wikitree',
    platform: 'linux',
    language: 'zh-CN',
    recentRepositories: [],
    recentFiles: [],
    ...actions
  })
  const fileMenu = template.find((item) => item.label === '文件')
  const editMenu = template.find((item) => item.label === '编辑')
  const viewMenu = template.find((item) => item.label === '视图')

  assert.ok(fileMenu)
  assert.ok(editMenu)
  assert.ok(viewMenu)
  assert.deepEqual(
    fileMenu.submenu.map((item) => item.label ?? item.type),
    ['打开仓库...', '最近文件', 'separator', '保存', '关闭标签', '关闭窗口']
  )
  assert.deepEqual(
    fileMenu.submenu[1].submenu.map((item) => item.label ?? item.type),
    [
      '最近项目',
      '无最近项目',
      'separator',
      '最近文件',
      '无最近文件',
      'separator',
      '清除最近打开...'
    ]
  )
  assert.equal(editMenu.submenu[9].label, '查找')
  assert.equal(editMenu.submenu[10].label, '搜索仓库...')
  assert.equal(editMenu.submenu[12].label, '设置...')
  assert.deepEqual(
    editMenu.submenu.map((item) => item.label ?? item.role ?? item.type),
    [
      '撤销',
      '重做',
      'separator',
      '剪切',
      '复制',
      '粘贴',
      '粘贴并匹配样式',
      '删除',
      'separator',
      '查找',
      '搜索仓库...',
      'separator',
      '设置...',
      '全选'
    ]
  )
  assert.deepEqual(
    viewMenu.submenu.map((item) => item.label ?? item.role ?? item.type),
    ['重新加载', '切换开发者工具', 'separator', '切换文件树', 'separator', '重置缩放']
  )
})
