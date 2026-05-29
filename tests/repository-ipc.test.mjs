/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadRepositoryIpc() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/repository-ipc.ts',
    modules: ['src/main/repository-ipc.ts', 'src/shared/types.ts']
  })
  return module
}

function createHarness() {
  const handlers = new Map()
  const focusedWindow = { id: 'focused-window' }
  const senderWindow = { id: 'sender-window' }
  const loadedRepository = {
    name: 'repo',
    path: '/repo',
    rootPath: '/repo',
    branch: 'main',
    activeRef: 'main',
    source: 'working-tree',
    editable: true,
    refs: [],
    tree: []
  }
  const activated = []

  return {
    handlers,
    loadedRepository,
    activated,
    dependencies: {
      ipcMain: {
        handle: (channel, handler) => {
          handlers.set(channel, handler)
        }
      },
      getFocusedWindow: () => focusedWindow,
      getWindowFromWebContents: () => senderWindow,
      showOpenDialog: async () => ({ canceled: false, filePaths: ['/repo'] }),
      loadRepository: async (repoPath, options) => ({
        ...loadedRepository,
        path: repoPath,
        rootPath: options?.rootPath ?? loadedRepository.rootPath,
        activeRef: options?.ref ?? loadedRepository.activeRef,
        source: options?.source ?? loadedRepository.source
      }),
      openWorktree: async (repoPath, ref) => ({
        ...loadedRepository,
        path: `${repoPath}/.worktrees/${ref}`,
        rootPath: repoPath,
        activeRef: ref,
        source: 'worktree'
      }),
      getPreview: async (repoPath, relativePath, options) => ({
        kind: 'preview',
        repoPath,
        relativePath,
        options
      }),
      saveFile: async (repoPath, relativePath, content) => ({
        repoPath,
        relativePath,
        content
      }),
      activateRepositoryInWindow: async (sourceWindow, repository) => {
        activated.push({ sourceWindow, repository })
      }
    }
  }
}

test('registerRepositoryIpcHandlers registers all repository load channels', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)

  assert.deepEqual(
    [...handlers.keys()],
    [
      'repository:pick',
      'repository:load',
      'repository:load-ref',
      'repository:open-worktree',
      'repository:preview',
      'repository:save-file'
    ]
  )
})

test('repository:load activates the repository in the sender window', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, activated, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const repository = await handlers.get('repository:load')({ sender: {} }, '/repo')

  assert.equal(repository.path, '/repo')
  assert.deepEqual(activated, [{ sourceWindow: { id: 'sender-window' }, repository }])
})

test('repository:load-ref loads a ref from the requested root path', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()
  const seenLoads = []
  dependencies.loadRepository = async (repoPath, options) => {
    seenLoads.push({ repoPath, options })
    return {
      ...createHarness().loadedRepository,
      path: repoPath,
      rootPath: options.rootPath,
      activeRef: options.ref,
      source: options.source
    }
  }

  registerRepositoryIpcHandlers(dependencies)
  await handlers.get('repository:load-ref')({ sender: {} }, '/repo', 'feature/docs', '/root')

  assert.deepEqual(seenLoads, [
    { repoPath: '/repo', options: { ref: 'feature/docs', source: 'git-ref', rootPath: '/root' } }
  ])
})

test('repository:preview returns a preview for the requested repository path', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const preview = await handlers.get('repository:preview')({}, '/repo', 'docs/index.md', {
    ref: 'main'
  })

  assert.deepEqual(preview, {
    kind: 'preview',
    repoPath: '/repo',
    relativePath: 'docs/index.md',
    options: { ref: 'main' }
  })
})

test('repository:save-file saves content for the requested repository path', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const result = await handlers.get('repository:save-file')({}, '/repo', 'README.md', '# Hi')

  assert.deepEqual(result, {
    repoPath: '/repo',
    relativePath: 'README.md',
    content: '# Hi'
  })
})
