/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadInitialRepositoryPath() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/initial-repository-path.ts',
    modules: ['src/main/initial-repository-path.ts']
  })
  return module
}

test('getInitialRepositoryPath returns the environment path first', async () => {
  const { getInitialRepositoryPath } = await loadInitialRepositoryPath()

  assert.equal(
    getInitialRepositoryPath({
      envPath: '/env/repo',
      argv: ['app', '/argv/repo'],
      isAbsolutePath: () => true,
      isDirectory: () => true
    }),
    '/env/repo'
  )
})

test('getInitialRepositoryPath returns the first absolute argv directory', async () => {
  const { getInitialRepositoryPath } = await loadInitialRepositoryPath()

  assert.equal(
    getInitialRepositoryPath({
      argv: ['app', 'relative', '/missing', '/file', '/repo'],
      isAbsolutePath: (path) => path.startsWith('/'),
      isDirectory: (path) => path === '/repo'
    }),
    '/repo'
  )
})

test('getInitialRepositoryPath ignores stat failures', async () => {
  const { getInitialRepositoryPath } = await loadInitialRepositoryPath()

  assert.equal(
    getInitialRepositoryPath({
      argv: ['app', '/throws', '/repo'],
      isAbsolutePath: () => true,
      isDirectory: (path) => {
        if (path === '/throws') throw new Error('boom')
        return true
      }
    }),
    '/repo'
  )
})
