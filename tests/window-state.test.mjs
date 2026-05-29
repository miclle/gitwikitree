/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadWindowState() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/window-state.ts',
    modules: ['src/main/window-state.ts', 'src/main/session-store.ts', 'src/shared/types.ts']
  })
  return module
}

function createSessionState() {
  return {
    repositoryPath: '/repo',
    selectedPath: 'README.md',
    openFileTabs: [{ path: 'README.md', name: 'README.md', type: 'file' }],
    expandedPaths: ['', 'docs'],
    windowState: { width: 1000, height: 700 },
    projectSessions: {
      '/repo': {
        repositoryPath: '/repo',
        selectedPath: 'README.md',
        openFileTabs: [{ path: 'README.md', name: 'README.md', type: 'file' }],
        expandedPaths: ['', 'docs'],
        windowState: { x: 10, y: 20, width: 1200, height: 800, isMaximized: true }
      }
    },
    recentRepositories: [],
    recentFiles: []
  }
}

test('getBrowserWindowBounds returns saved global or project window bounds', async () => {
  const { getBrowserWindowBounds } = await loadWindowState()
  const sessionState = createSessionState()

  assert.deepEqual(getBrowserWindowBounds(sessionState), { width: 1000, height: 700 })
  assert.deepEqual(getBrowserWindowBounds(sessionState, '/repo'), {
    x: 10,
    y: 20,
    width: 1200,
    height: 800
  })
  assert.deepEqual(getBrowserWindowBounds(sessionState, '/missing'), {})
})

test('readWindowState reads normal bounds for maximized windows', async () => {
  const { readWindowState } = await loadWindowState()
  const browserWindow = {
    isMaximized: () => true,
    getNormalBounds: () => ({ x: 1, y: 2, width: 900, height: 600 }),
    getBounds: () => ({ x: 9, y: 9, width: 100, height: 100 })
  }

  assert.deepEqual(readWindowState(browserWindow), {
    x: 1,
    y: 2,
    width: 900,
    height: 600,
    isMaximized: true
  })
})

test('mergeWindowStateIntoSession updates global or project window state', async () => {
  const { mergeWindowStateIntoSession } = await loadWindowState()
  const sessionState = createSessionState()
  const windowState = { x: 3, y: 4, width: 1100, height: 900, isMaximized: false }

  assert.deepEqual(
    mergeWindowStateIntoSession(sessionState, undefined, windowState).windowState,
    windowState
  )

  const projectSession = mergeWindowStateIntoSession(sessionState, '/repo', windowState)
    .projectSessions['/repo']
  assert.equal(projectSession.selectedPath, 'README.md')
  assert.deepEqual(projectSession.windowState, windowState)

  const newProject = mergeWindowStateIntoSession(sessionState, '/new-repo', windowState)
    .projectSessions['/new-repo']
  assert.deepEqual(newProject, {
    repositoryPath: '/new-repo',
    selectedPath: '',
    openFileTabs: [],
    expandedPaths: [''],
    windowState
  })
})
