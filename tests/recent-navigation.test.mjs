/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadRecentNavigation() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/recent-navigation.ts',
    modules: ['src/main/recent-navigation.ts', 'src/main/session-store.ts', 'src/shared/types.ts']
  })
  return module
}

function createWindow(id, repoPath) {
  const calls = []

  return {
    id,
    repoPath,
    calls,
    webContents: {
      send: (channel, payload) => calls.push(['send', channel, payload])
    },
    isMinimized: () => false,
    restore: () => calls.push(['restore']),
    show: () => calls.push(['show']),
    focus: () => calls.push(['focus'])
  }
}

function createRecentFile() {
  return {
    repoPath: '/repo',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z'
  }
}

test('openRecentRepository focuses an existing repository window', async () => {
  const { openRecentRepository } = await loadRecentNavigation()
  const repoWindow = createWindow('repo', '/repo')
  const otherWindow = createWindow('other', '/other')
  const createdWindows = []

  openRecentRepository('/repo', {
    getAllWindows: () => [otherWindow, repoWindow],
    getFocusedWindow: () => otherWindow,
    getWindowRepositoryPath: (window) => window.repoPath,
    createWindow: (repoPath) => createdWindows.push(repoPath)
  })

  assert.deepEqual(repoWindow.calls, [['show'], ['focus']])
  assert.deepEqual(createdWindows, [])
})

test('openRecentRepository sends open path to a focused fallback window', async () => {
  const { openRecentRepository } = await loadRecentNavigation()
  const focusedWindow = createWindow('focused')
  const createdWindows = []

  openRecentRepository('/repo', {
    getAllWindows: () => [focusedWindow],
    getFocusedWindow: () => focusedWindow,
    getWindowRepositoryPath: () => undefined,
    createWindow: (repoPath) => createdWindows.push(repoPath)
  })

  assert.deepEqual(focusedWindow.calls, [['send', 'repository:open-path', '/repo']])
  assert.deepEqual(createdWindows, [])
})

test('openRecentFile sends a recent file to a focused window or creates one', async () => {
  const { openRecentFile } = await loadRecentNavigation()
  const focusedWindow = createWindow('focused')
  const file = createRecentFile()
  const sentFiles = []
  const createdWindows = []

  openRecentFile(file, {
    getFocusedWindow: () => focusedWindow,
    getAllWindows: () => [focusedWindow],
    sendOpenFile: (window, recentFile) => sentFiles.push([window.id, recentFile.filePath]),
    createWindow: (repoPath, recentFile) => createdWindows.push([repoPath, recentFile.filePath])
  })

  assert.deepEqual(sentFiles, [['focused', 'README.md']])
  assert.deepEqual(createdWindows, [])
})

test('recent menu item helpers honor modifier-new-window events', async () => {
  const { openRecentFileMenuItem, openRecentRepositoryMenuItem } = await loadRecentNavigation()
  const file = createRecentFile()
  const createdWindows = []

  openRecentRepositoryMenuItem(
    '/repo',
    { metaKey: true, altKey: false },
    {
      createWindow: (repoPath, recentFile) => createdWindows.push([repoPath, recentFile?.filePath]),
      getAllWindows: () => [],
      getFocusedWindow: () => undefined,
      getWindowRepositoryPath: () => undefined
    }
  )
  openRecentFileMenuItem(
    file,
    { metaKey: false, altKey: true },
    {
      createWindow: (repoPath, recentFile) => createdWindows.push([repoPath, recentFile?.filePath]),
      getAllWindows: () => [],
      getFocusedWindow: () => undefined,
      getWindowRepositoryPath: () => undefined,
      sendOpenFile: () => undefined
    }
  )

  assert.deepEqual(createdWindows, [
    ['/repo', undefined],
    ['/repo', 'README.md']
  ])
})
