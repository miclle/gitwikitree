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
        source: options?.source ?? loadedRepository.source
      }),
      checkoutBranch: async (repoPath, branch) => ({
        ...loadedRepository,
        path: repoPath,
        branch,
        activeRef: branch,
        source: 'working-tree'
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
      getBlame: async (repoPath, relativePath, options) => ({
        kind: 'blame',
        repoPath,
        relativePath,
        options
      }),
      saveFile: async (repoPath, relativePath, content, options) => ({
        repoPath,
        relativePath,
        content,
        options
      }),
      searchRepository: async (repoPath, query, options) => ({
        repoPath,
        query,
        options
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
      'repository:checkout-branch',
      'repository:open-worktree',
      'repository:preview',
      'repository:blame',
      'repository:save-file',
      'repository:search'
    ]
  )
})

test('repository:blame returns blame for the requested repository path', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const blame = await handlers.get('repository:blame')({}, '/repo', 'docs/index.md', {
    source: 'worktree',
    rootPath: '/repo'
  })

  assert.deepEqual(blame, {
    kind: 'blame',
    repoPath: '/repo',
    relativePath: 'docs/index.md',
    options: {
      source: 'worktree',
      rootPath: '/repo'
    }
  })
})

test('repository:load activates the repository in the sender window', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, activated, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const repository = await handlers.get('repository:load')({ sender: {} }, '/repo')

  assert.equal(repository.path, '/repo')
  assert.deepEqual(activated, [{ sourceWindow: { id: 'sender-window' }, repository }])
})

test('repository:checkout-branch switches a local branch and activates the workspace', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, activated, dependencies } = createHarness()
  const seenCheckouts = []
  dependencies.checkoutBranch = async (repoPath, branch) => {
    seenCheckouts.push({ repoPath, branch })
    return {
      ...createHarness().loadedRepository,
      path: repoPath,
      branch,
      activeRef: branch,
      source: 'working-tree'
    }
  }

  registerRepositoryIpcHandlers(dependencies)
  const repository = await handlers.get('repository:checkout-branch')(
    { sender: {} },
    '/repo',
    'feature/docs'
  )

  assert.deepEqual(seenCheckouts, [{ repoPath: '/repo', branch: 'feature/docs' }])
  assert.equal(repository.source, 'working-tree')
  assert.equal(repository.activeRef, 'feature/docs')
  assert.deepEqual(activated, [{ sourceWindow: { id: 'sender-window' }, repository }])
})

test('repository:preview returns a preview for the requested repository path', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const preview = await handlers.get('repository:preview')({}, '/repo', 'docs/index.md')

  assert.deepEqual(preview, {
    kind: 'preview',
    repoPath: '/repo',
    relativePath: 'docs/index.md',
    options: undefined
  })
})

test('repository:save-file saves content for the requested repository path and context', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const result = await handlers.get('repository:save-file')({}, '/repo', 'README.md', '# Hi', {
    source: 'worktree',
    rootPath: '/root',
    expectedModifiedAt: '2026-05-30T00:00:00.000Z'
  })

  assert.deepEqual(result, {
    repoPath: '/repo',
    relativePath: 'README.md',
    content: '# Hi',
    options: {
      source: 'worktree',
      rootPath: '/root',
      expectedModifiedAt: '2026-05-30T00:00:00.000Z'
    }
  })
})

test('repository:search searches within the requested local workspace', async () => {
  const { registerRepositoryIpcHandlers } = await loadRepositoryIpc()
  const { handlers, dependencies } = createHarness()

  registerRepositoryIpcHandlers(dependencies)
  const result = await handlers.get('repository:search')({}, '/repo', 'alpha', {
    source: 'worktree',
    rootPath: '/repo'
  })

  assert.deepEqual(result, {
    repoPath: '/repo',
    query: 'alpha',
    options: {
      source: 'worktree',
      rootPath: '/repo'
    }
  })
})
