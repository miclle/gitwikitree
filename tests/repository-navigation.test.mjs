/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadRepositoryNavigation() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/repository-navigation.ts')
  return module
}

const repository = {
  name: 'wiki',
  tree: [
    {
      name: 'docs',
      path: 'docs',
      type: 'directory',
      index: { name: 'index.md', path: 'docs/index.md' },
      children: [{ name: 'guide.md', path: 'docs/guide.md', type: 'file' }]
    }
  ],
  index: { name: 'README.md', path: 'README.md' }
}

test('resolveRepositoryNavigationTarget maps hidden root index files to the root directory', async () => {
  const { resolveRepositoryNavigationTarget } = await loadRepositoryNavigation()

  assert.deepEqual(resolveRepositoryNavigationTarget(repository, 'README.md')?.target, {
    path: '',
    name: 'wiki',
    type: 'directory'
  })
})

test('resolveRepositoryNavigationTarget maps the empty path to the root directory', async () => {
  const { resolveRepositoryNavigationTarget } = await loadRepositoryNavigation()

  assert.deepEqual(resolveRepositoryNavigationTarget(repository, '')?.target, {
    path: '',
    name: 'wiki',
    type: 'directory'
  })
})

test('resolveRepositoryNavigationTarget maps hidden child index files to their directory', async () => {
  const { resolveRepositoryNavigationTarget } = await loadRepositoryNavigation()

  const resolved = resolveRepositoryNavigationTarget(repository, 'docs/index.md')

  assert.equal(resolved?.node?.path, 'docs')
  assert.deepEqual(resolved?.target, {
    path: 'docs',
    name: 'docs',
    type: 'directory'
  })
})

test('resolveRepositoryNavigationTarget still resolves visible files directly', async () => {
  const { resolveRepositoryNavigationTarget } = await loadRepositoryNavigation()

  const resolved = resolveRepositoryNavigationTarget(repository, 'docs/guide.md')

  assert.equal(resolved?.node?.path, 'docs/guide.md')
  assert.deepEqual(resolved?.target, {
    path: 'docs/guide.md',
    name: 'guide.md',
    type: 'file'
  })
})
