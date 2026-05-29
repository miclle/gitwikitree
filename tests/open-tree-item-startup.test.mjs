/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readPreload() {
  return readFile(new URL('../src/preload/index.ts', import.meta.url), 'utf8')
}

async function readWorkspaceHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useRepositoryWorkspace.ts', import.meta.url),
    'utf8'
  )
}

test('preload caches an initial tree item open event before React subscribes', async () => {
  const source = await readPreload()

  assert.match(
    source,
    /let pendingOpenTreeItem/,
    'preload should retain an early repository:open-tree-item payload'
  )
  assert.match(
    source,
    /ipcRenderer\.on\('repository:open-tree-item'/,
    'preload should subscribe to initial tree item opens immediately'
  )
})

test('workspace registers launch listeners before restoring session', async () => {
  const source = await readWorkspaceHook()
  const listenerIndex = source.indexOf('window.api.onOpenTreeItem((item)')
  const restoreIndex = source.indexOf('window.api.getSession().then')

  assert.notEqual(listenerIndex, -1, 'workspace should listen for tree item open intents')
  assert.notEqual(restoreIndex, -1, 'workspace should restore persisted session state')
  assert.ok(
    listenerIndex < restoreIndex,
    'explicit open intents should be observed before session restore can overwrite tabs'
  )
})

test('workspace reads project session before loading an opened repository path', async () => {
  const source = await readWorkspaceHook()
  const loaderStart = source.indexOf('const loadRepositoryPath = useCallback')
  const loaderEnd = source.indexOf('const loadRepositoryWithSession = useCallback')

  assert.notEqual(loaderStart, -1, 'workspace should define repository path loading')
  assert.notEqual(loaderEnd, -1, 'workspace should define session loading after path loading')

  const loaderSource = source.slice(loaderStart, loaderEnd)
  const sessionIndex = loaderSource.indexOf('window.api.getProjectSession(repoPath)')
  const repositoryLoadIndex = loaderSource.indexOf('window.api.loadRepository(repoPath)')

  assert.notEqual(sessionIndex, -1, 'repository path loading should read saved project session')
  assert.notEqual(
    repositoryLoadIndex,
    -1,
    'repository path loading should fall back to working tree loading'
  )
  assert.ok(
    sessionIndex < repositoryLoadIndex,
    'saved ref context should be known before loading the repository path'
  )
  assert.match(
    loaderSource,
    /window\.api\.getProjectSession\(nextRepository\.path\)/,
    'repository path loading should retry project session lookup with the normalized repository path'
  )
})
