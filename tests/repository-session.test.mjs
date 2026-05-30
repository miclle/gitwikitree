/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadRepositorySession() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/repository-session.ts',
    modules: ['src/main/repository-session.ts', 'src/shared/types.ts']
  })
  return module
}

test('createRepositorySessionReset returns the clean active repository session state', async () => {
  const { createRepositorySessionReset } = await loadRepositorySession()
  const session = createRepositorySessionReset({
    name: 'repo',
    path: '/repo',
    rootPath: '/repo-root',
    branch: 'feature/docs',
    activeRef: 'feature/docs',
    source: 'worktree',
    editable: true,
    refs: [],
    tree: []
  })

  assert.deepEqual(session, {
    repositoryPath: '/repo',
    rootPath: '/repo-root',
    activeRef: 'feature/docs',
    source: 'worktree',
    selectedPath: '',
    activeFilePath: undefined,
    activeFileTabId: undefined,
    openFileTabs: [],
    expandedPaths: ['']
  })
})
