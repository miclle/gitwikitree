/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadRepositoryTree() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/repository-tree.ts',
    modules: ['src/main/repository-tree.ts', 'src/shared/types.ts']
  })
  return module
}

test('buildRepositoryTree uses configurable directory index order', async () => {
  const { buildRepositoryTree } = await loadRepositoryTree()

  const repository = buildRepositoryTree(
    ['README.md', 'index.md', '_index.md', 'docs/README.md', 'docs/_index.md'],
    new Set(),
    ['_index.md', 'README.md']
  )

  assert.deepEqual(repository.index, { name: '_index.md', path: '_index.md' })
  assert.deepEqual(repository.tree[0].index, { name: '_index.md', path: 'docs/_index.md' })
})
