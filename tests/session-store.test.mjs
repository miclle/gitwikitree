/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function loadSessionStore() {
  const source = await readFile(new URL('../src/main/session-store.ts', import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  })

  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`)
}

test('recordRecentFile keeps the newest file first and de-duplicates entries', async () => {
  const { recordRecentFile } = await loadSessionStore()
  const current = [
    {
      repoPath: '/repo',
      filePath: 'README.md',
      name: 'README.md',
      openedAt: '2026-05-26T00:00:00.000Z'
    }
  ]

  const next = recordRecentFile(current, {
    repoPath: '/repo',
    filePath: 'src/App.tsx',
    name: 'App.tsx',
    openedAt: '2026-05-27T00:00:00.000Z'
  })
  const deduped = recordRecentFile(next, {
    repoPath: '/repo',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T01:00:00.000Z'
  })

  assert.deepEqual(
    deduped.map((item) => item.filePath),
    ['README.md', 'src/App.tsx']
  )
  assert.equal(deduped[0].openedAt, '2026-05-27T01:00:00.000Z')
})

test('normalizeSessionState drops invalid paths and caps recent files', async () => {
  const { maxRecentFiles, normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    repositoryPath: '/repo',
    selectedPath: '../outside.md',
    activeFilePath: 'notes/today.md',
    openFileTabs: [
      { path: 'README.md', name: 'README.md' },
      { path: '/absolute.md', name: 'absolute.md' },
      { path: 'notes/today.md', name: 'today.md' }
    ],
    recentFiles: Array.from({ length: maxRecentFiles + 3 }, (_, index) => ({
      repoPath: '/repo',
      filePath: `file-${index}.md`,
      name: `file-${index}.md`,
      openedAt: '2026-05-27T00:00:00.000Z'
    }))
  })

  assert.equal(state.repositoryPath, '/repo')
  assert.equal(state.selectedPath, '')
  assert.equal(state.activeFilePath, 'notes/today.md')
  assert.deepEqual(
    state.openFileTabs.map((tab) => tab.path),
    ['README.md', 'notes/today.md']
  )
  assert.equal(state.recentFiles.length, maxRecentFiles)
})

test('getOpenFileTabsForRecentFile resets tabs when switching repositories', async () => {
  const { getOpenFileTabsForRecentFile } = await loadSessionStore()
  const tabs = getOpenFileTabsForRecentFile({
    currentRepositoryPath: '/repo-a',
    nextRepositoryPath: '/repo-b',
    currentTabs: [{ path: 'old.md', name: 'old.md' }],
    nextTab: { path: 'docs/new.md', name: 'new.md' }
  })

  assert.deepEqual(tabs, [{ path: 'docs/new.md', name: 'new.md' }])
})

test('getOpenFileTabsForRecentFile keeps existing tabs for the same repository', async () => {
  const { getOpenFileTabsForRecentFile } = await loadSessionStore()
  const tabs = getOpenFileTabsForRecentFile({
    currentRepositoryPath: '/repo-a',
    nextRepositoryPath: '/repo-a',
    currentTabs: [{ path: 'old.md', name: 'old.md' }],
    nextTab: { path: 'docs/new.md', name: 'new.md' }
  })

  assert.deepEqual(tabs, [
    { path: 'old.md', name: 'old.md' },
    { path: 'docs/new.md', name: 'new.md' }
  ])
})
