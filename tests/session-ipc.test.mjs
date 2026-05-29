/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadSessionIpc() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/session-ipc.ts',
    modules: ['src/main/session-ipc.ts', 'src/main/session-store.ts', 'src/shared/types.ts']
  })
  return module
}

function createHarness() {
  const handlers = new Map()
  const senderWindow = { id: 'sender-window' }
  const windowRepositoryPaths = []
  let writes = 0
  let menus = 0
  let sessionState = {
    selectedPath: '',
    openFileTabs: [],
    expandedPaths: [''],
    projectSessions: {},
    recentRepositories: [],
    recentFiles: []
  }

  return {
    handlers,
    get sessionState() {
      return sessionState
    },
    windowRepositoryPaths,
    get writes() {
      return writes
    },
    get menus() {
      return menus
    },
    dependencies: {
      ipcMain: {
        handle: (channel, handler) => {
          handlers.set(channel, handler)
        }
      },
      getWindowFromWebContents: () => senderWindow,
      getSessionState: () => sessionState,
      setSessionState: (nextSessionState) => {
        sessionState = nextSessionState
      },
      setWindowRepositoryPath: (sourceWindow, repoPath) => {
        windowRepositoryPaths.push({ sourceWindow, repoPath })
      },
      writeStoredSession: async () => {
        writes += 1
      },
      createAppMenu: () => {
        menus += 1
      }
    }
  }
}

test('registerSessionIpcHandlers registers all session channels', async () => {
  const { registerSessionIpcHandlers } = await loadSessionIpc()
  const { handlers, dependencies } = createHarness()

  registerSessionIpcHandlers(dependencies)

  assert.deepEqual([...handlers.keys()], ['session:get', 'session:get-project', 'session:save'])
})

test('session:save records the active repository and active file', async () => {
  const { registerSessionIpcHandlers } = await loadSessionIpc()
  const harness = createHarness()

  registerSessionIpcHandlers(harness.dependencies)
  const saved = await harness.handlers.get('session:save')(
    { sender: {} },
    {
      repositoryPath: '/repo',
      rootPath: '/repo-root',
      activeRef: 'main',
      source: 'working-tree',
      selectedPath: 'README.md',
      activeFilePath: 'README.md',
      openFileTabs: [{ path: 'README.md', name: 'README.md', type: 'file' }],
      expandedPaths: ['', 'docs']
    }
  )

  assert.equal(saved.repositoryPath, '/repo')
  assert.deepEqual(harness.windowRepositoryPaths, [
    { sourceWindow: { id: 'sender-window' }, repoPath: '/repo' }
  ])
  assert.deepEqual(
    saved.recentRepositories.map((repo) => repo.repoPath),
    ['/repo']
  )
  assert.deepEqual(
    saved.recentFiles.map((file) => file.filePath),
    ['README.md']
  )
  assert.equal(harness.writes, 1)
  assert.equal(harness.menus, 1)
})
