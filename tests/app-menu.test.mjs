/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAppMenu() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/app-menu.ts',
    modules: ['src/main/app-menu.ts', 'src/main/session-store.ts', 'src/shared/types.ts']
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

  assert.deepEqual(
    recentMenu.submenu.map((item) => item.label ?? item.type),
    [
      '最近打开的项目',
      'repo - /repo',
      'separator',
      'Recent Files',
      'README.md - /repo',
      'separator',
      '清除最近打开...'
    ]
  )
  assert.deepEqual(calls, [
    ['openRepository'],
    ['openRecentRepository', '/repo', event],
    ['openRecentFile', 'README.md', event],
    ['closeCurrentTabOrWindow']
  ])
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
      { label: '最近打开的项目', enabled: false },
      { label: 'No Recent Projects', enabled: false },
      { label: undefined, enabled: undefined },
      { label: 'Recent Files', enabled: false },
      { label: 'No Recent Files', enabled: false },
      { label: undefined, enabled: undefined },
      { label: '清除最近打开...', enabled: false }
    ]
  )
})
