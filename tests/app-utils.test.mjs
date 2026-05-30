/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAppUtils() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/repository-label.ts',
    prefix: 'gitwikitree-app-utils-test-',
    modules: ['src/renderer/src/repository-label.ts', 'src/shared/types.ts']
  })

  return { module, tempDir }
}

function createRepository(overrides = {}) {
  return {
    name: 'las',
    path: '/Users/miclle/github/miclle/las',
    rootPath: '/Users/miclle/github/miclle/las',
    branch: 'develop',
    activeRef: 'develop',
    source: 'working-tree',
    editable: true,
    refs: [],
    tree: [],
    ...overrides
  }
}

test('getRepositoryLabel shows owner and repo for the primary working tree', async () => {
  const { module, tempDir } = await loadAppUtils()

  try {
    assert.equal(module.getRepositoryLabel(createRepository()), 'miclle/las')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getRepositoryLabel appends the branch name for linked worktrees', async () => {
  const { module, tempDir } = await loadAppUtils()

  try {
    assert.equal(
      module.getRepositoryLabel(
        createRepository({
          name: 'wiki',
          path: '/Users/miclle/github/miclle/las/.worktrees/wiki',
          activeRef: 'wiki',
          source: 'worktree'
        })
      ),
      'miclle/las/wiki'
    )
    assert.equal(
      module.getRepositoryLabel(
        createRepository({
          name: 'feat-sandbox',
          path: '/Users/miclle/github/miclle/las/.worktrees/feat-sandbox',
          activeRef: 'feat/sandbox',
          source: 'worktree'
        })
      ),
      'miclle/las/feat/sandbox'
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
