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
  assert.deepEqual(
    repository.tree.map((node) => node.path),
    ['docs', '_index.md', 'index.md', 'README.md']
  )
  assert.deepEqual(repository.tree[0].index, { name: '_index.md', path: 'docs/_index.md' })
  assert.deepEqual(
    repository.tree[0].children.map((node) => node.path),
    ['docs/_index.md', 'docs/README.md']
  )
})

test('buildRepositoryTree keeps home files visible when directory indexes are disabled', async () => {
  const { buildRepositoryTree } = await loadRepositoryTree()

  const repository = buildRepositoryTree(
    ['README.md', 'index.md', 'docs/README.md', 'docs/guide.md'],
    new Set(),
    ['README.md', 'index.md'],
    false
  )

  assert.equal(repository.index, undefined)
  assert.deepEqual(
    repository.tree.map((node) => node.path),
    ['docs', 'index.md', 'README.md']
  )
  assert.equal(repository.tree[0].index, undefined)
  assert.deepEqual(
    repository.tree[0].children.map((node) => node.path),
    ['docs/guide.md', 'docs/README.md']
  )
})
