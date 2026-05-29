/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadOpenRepositoryDialog() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/open-repository-dialog.ts',
    modules: ['src/main/open-repository-dialog.ts', 'src/shared/types.ts']
  })
  return module
}

function createRepository(path = '/repo') {
  return {
    name: 'repo',
    path,
    rootPath: path,
    branch: 'main',
    activeRef: 'main',
    source: 'working-tree',
    editable: true,
    refs: [],
    tree: []
  }
}

test('openRepositoryInNewWindow loads a selected repository and opens a window', async () => {
  const { openRepositoryInNewWindow } = await loadOpenRepositoryDialog()
  const calls = []
  const focusedWindow = { id: 'focused-window' }

  await openRepositoryInNewWindow({
    getFocusedWindow: () => focusedWindow,
    showOpenDialog: async (window, options) => {
      calls.push(['showOpenDialog', window, options])
      return { canceled: false, filePaths: ['/repo'] }
    },
    loadRepository: async (repoPath) => {
      calls.push(['loadRepository', repoPath])
      return createRepository(repoPath)
    },
    createWindow: (repoPath) => calls.push(['createWindow', repoPath]),
    showErrorBox: (title, message) => calls.push(['showErrorBox', title, message])
  })

  assert.deepEqual(calls, [
    [
      'showOpenDialog',
      focusedWindow,
      { title: 'Open Git Repository', properties: ['openDirectory'] }
    ],
    ['loadRepository', '/repo'],
    ['createWindow', '/repo']
  ])
})

test('openRepositoryInNewWindow does nothing when selection is canceled', async () => {
  const { openRepositoryInNewWindow } = await loadOpenRepositoryDialog()
  const calls = []

  await openRepositoryInNewWindow({
    getFocusedWindow: () => undefined,
    showOpenDialog: async (options) => {
      calls.push(['showOpenDialog', options])
      return { canceled: true, filePaths: [] }
    },
    loadRepository: async () => {
      throw new Error('should not load')
    },
    createWindow: () => calls.push(['createWindow']),
    showErrorBox: (title, message) => calls.push(['showErrorBox', title, message])
  })

  assert.deepEqual(calls, [
    ['showOpenDialog', { title: 'Open Git Repository', properties: ['openDirectory'] }]
  ])
})

test('openRepositoryInNewWindow shows an error when loading fails', async () => {
  const { openRepositoryInNewWindow } = await loadOpenRepositoryDialog()
  const calls = []

  await openRepositoryInNewWindow({
    getFocusedWindow: () => undefined,
    showOpenDialog: async () => ({ canceled: false, filePaths: ['/repo'] }),
    loadRepository: async () => {
      throw new Error('not a repository')
    },
    createWindow: (repoPath) => calls.push(['createWindow', repoPath]),
    showErrorBox: (title, message) => calls.push(['showErrorBox', title, message])
  })

  assert.deepEqual(calls, [['showErrorBox', 'Open Repository Failed', 'not a repository']])
})
