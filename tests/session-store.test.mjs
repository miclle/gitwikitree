/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadSessionStore() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/session-store.ts',
    modules: ['src/main/session-store.ts', 'src/shared/types.ts']
  })
  return module
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

test('recordRecentFile preserves the repository ref context for recent files', async () => {
  const { recordRecentFile } = await loadSessionStore()
  const recentFiles = recordRecentFile([], {
    repoPath: '/repo',
    rootPath: '/repo-root',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z',
    activeRef: 'feature/docs',
    source: 'git-ref'
  })

  assert.deepEqual(recentFiles[0], {
    repoPath: '/repo',
    rootPath: '/repo-root',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z',
    activeRef: 'feature/docs',
    source: 'git-ref'
  })
})

test('getRecentFileOpenPayload preserves the repository ref context', async () => {
  const { getRecentFileOpenPayload } = await loadSessionStore()
  const payload = getRecentFileOpenPayload({
    repoPath: '/repo',
    rootPath: '/repo-root',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z',
    activeRef: 'feature/docs',
    source: 'git-ref'
  })

  assert.deepEqual(payload, {
    repoPath: '/repo',
    rootPath: '/repo-root',
    filePath: 'README.md',
    name: 'README.md',
    openedAt: '2026-05-27T00:00:00.000Z',
    activeRef: 'feature/docs',
    source: 'git-ref'
  })
})

test('getRecentRepositories returns newest unique repositories from recent files', async () => {
  const { getRecentRepositories } = await loadSessionStore()
  const repositories = getRecentRepositories([
    {
      repoPath: '/repo-a',
      filePath: 'README.md',
      name: 'README.md',
      openedAt: '2026-05-27T03:00:00.000Z'
    },
    {
      repoPath: '/repo-b',
      filePath: 'docs/guide.md',
      name: 'guide.md',
      openedAt: '2026-05-27T02:00:00.000Z'
    },
    {
      repoPath: '/repo-a',
      filePath: 'docs/intro.md',
      name: 'intro.md',
      openedAt: '2026-05-27T01:00:00.000Z'
    }
  ])

  assert.deepEqual(repositories, ['/repo-a', '/repo-b'])
})

test('recordRecentRepository keeps projects even when no files were opened', async () => {
  const { recordRecentRepository } = await loadSessionStore()
  const repositories = recordRecentRepository([], {
    repoPath: '/repo-a',
    name: 'repo-a',
    openedAt: '2026-05-27T00:00:00.000Z'
  })

  assert.deepEqual(repositories, [
    {
      repoPath: '/repo-a',
      name: 'repo-a',
      openedAt: '2026-05-27T00:00:00.000Z'
    }
  ])
})

test('normalizeSessionState keeps recent repositories independently from recent files', async () => {
  const { getRecentRepositories, normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    selectedPath: '',
    openFileTabs: [],
    expandedPaths: [''],
    recentRepositories: [
      {
        repoPath: '/repo-without-files',
        name: 'repo-without-files',
        openedAt: '2026-05-27T00:00:00.000Z'
      }
    ],
    recentFiles: []
  })

  assert.deepEqual(state.recentRepositories, [
    {
      repoPath: '/repo-without-files',
      name: 'repo-without-files',
      openedAt: '2026-05-27T00:00:00.000Z'
    }
  ])
  assert.deepEqual(getRecentRepositories(state.recentRepositories, state.recentFiles), [
    '/repo-without-files'
  ])
})

test('findRepositoryWindowIndex returns the first window for an open repository', async () => {
  const { findRepositoryWindowIndex } = await loadSessionStore()

  assert.equal(
    findRepositoryWindowIndex('/repo-b', [undefined, '/repo-a', '/repo-b', '/repo-b']),
    2
  )
  assert.equal(findRepositoryWindowIndex('/repo-c', [undefined, '/repo-a', '/repo-b']), -1)
})

test('clearRecentFiles removes only recent files from session state', async () => {
  const { clearRecentFiles } = await loadSessionStore()
  const state = clearRecentFiles({
    repositoryPath: '/repo',
    rootPath: '/repo',
    activeRef: 'main',
    source: 'working-tree',
    selectedPath: 'README.md',
    activeFilePath: 'README.md',
    openFileTabs: [{ path: 'README.md', name: 'README.md' }],
    expandedPaths: ['', 'docs'],
    recentFiles: [
      {
        repoPath: '/repo',
        filePath: 'README.md',
        name: 'README.md',
        openedAt: '2026-05-27T00:00:00.000Z'
      }
    ]
  })

  assert.equal(state.repositoryPath, '/repo')
  assert.equal(state.activeFilePath, 'README.md')
  assert.deepEqual(state.recentFiles, [])
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

test('normalizeSessionState preserves per-tab history and duplicate file tabs', async () => {
  const { normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    repositoryPath: '/repo',
    selectedPath: 'README.md',
    activeFilePath: 'README.md',
    activeFileTabId: 'tab-b',
    openFileTabs: [
      {
        id: 'tab-a',
        path: 'docs/guide.md',
        name: 'guide.md',
        history: [
          { path: 'README.md', name: 'README.md' },
          { path: 'docs/guide.md', name: 'guide.md' }
        ],
        historyIndex: 1
      },
      {
        id: 'tab-b',
        path: 'docs/guide.md',
        name: 'guide.md',
        history: [{ path: 'docs/guide.md', name: 'guide.md' }],
        historyIndex: 0
      }
    ]
  })

  assert.equal(state.activeFileTabId, 'tab-b')
  assert.deepEqual(state.openFileTabs, [
    {
      id: 'tab-a',
      path: 'docs/guide.md',
      name: 'guide.md',
      history: [
        { path: 'README.md', name: 'README.md' },
        { path: 'docs/guide.md', name: 'guide.md' }
      ],
      historyIndex: 1
    },
    {
      id: 'tab-b',
      path: 'docs/guide.md',
      name: 'guide.md',
      history: [{ path: 'docs/guide.md', name: 'guide.md' }],
      historyIndex: 0
    }
  ])
})

test('normalizeSessionState preserves directory tabs and history targets', async () => {
  const { normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    repositoryPath: '/repo',
    selectedPath: 'docs',
    activeFileTabId: 'tab-docs',
    openFileTabs: [
      {
        id: 'tab-docs',
        path: 'docs',
        name: 'docs',
        type: 'directory',
        history: [
          { path: 'README.md', name: 'README.md', type: 'file' },
          { path: 'docs', name: 'docs', type: 'directory' }
        ],
        historyIndex: 1
      }
    ]
  })

  assert.deepEqual(state.openFileTabs, [
    {
      id: 'tab-docs',
      path: 'docs',
      name: 'docs',
      type: 'directory',
      history: [
        { path: 'README.md', name: 'README.md', type: 'file' },
        { path: 'docs', name: 'docs', type: 'directory' }
      ],
      historyIndex: 1
    }
  ])
})

test('normalizeSessionState preserves root directory tabs', async () => {
  const { normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    repositoryPath: '/repo',
    selectedPath: '',
    activeFileTabId: 'tab-root',
    openFileTabs: [
      {
        id: 'tab-root',
        path: '',
        name: 'repo',
        type: 'directory',
        history: [{ path: '', name: 'repo', type: 'directory' }],
        historyIndex: 0
      }
    ]
  })

  assert.deepEqual(state.openFileTabs, [
    {
      id: 'tab-root',
      path: '',
      name: 'repo',
      type: 'directory',
      history: [{ path: '', name: 'repo', type: 'directory' }],
      historyIndex: 0
    }
  ])
})

test('normalizeSessionState migrates the active project into project sessions', async () => {
  const { normalizeSessionState } = await loadSessionStore()
  const state = normalizeSessionState({
    repositoryPath: '/repo-a',
    selectedPath: 'README.md',
    activeFilePath: 'README.md',
    activeFileTabId: 'tab-a',
    openFileTabs: [{ id: 'tab-a', path: 'README.md', name: 'README.md' }],
    expandedPaths: ['', 'docs'],
    windowState: { x: 12, y: 24, width: 1300, height: 900, isMaximized: true }
  })

  assert.deepEqual(state.projectSessions['/repo-a'], {
    repositoryPath: '/repo-a',
    selectedPath: 'README.md',
    activeFilePath: 'README.md',
    activeFileTabId: 'tab-a',
    openFileTabs: [
      {
        id: 'tab-a',
        path: 'README.md',
        name: 'README.md',
        history: [{ path: 'README.md', name: 'README.md' }],
        historyIndex: 0
      }
    ],
    expandedPaths: ['', 'docs'],
    windowState: { x: 12, y: 24, width: 1300, height: 900, isMaximized: true }
  })
})

test('mergeSessionState updates only the active project session', async () => {
  const { mergeSessionState } = await loadSessionStore()
  const current = {
    repositoryPath: '/repo-a',
    selectedPath: 'README.md',
    openFileTabs: [{ path: 'README.md', name: 'README.md' }],
    expandedPaths: [''],
    projectSessions: {
      '/repo-b': {
        repositoryPath: '/repo-b',
        selectedPath: 'guide.md',
        openFileTabs: [{ path: 'guide.md', name: 'guide.md' }],
        expandedPaths: ['', 'docs'],
        windowState: { width: 1440, height: 960 }
      }
    },
    recentRepositories: [],
    recentFiles: []
  }

  const next = mergeSessionState(current, {
    repositoryPath: '/repo-a',
    selectedPath: 'docs/intro.md',
    activeFilePath: 'docs/intro.md',
    openFileTabs: [{ path: 'docs/intro.md', name: 'intro.md' }],
    expandedPaths: ['', 'docs'],
    windowState: { width: 1220, height: 820 }
  })

  assert.equal(next.projectSessions['/repo-a'].selectedPath, 'docs/intro.md')
  assert.equal(next.projectSessions['/repo-b'].selectedPath, 'guide.md')
  assert.deepEqual(next.projectSessions['/repo-b'].windowState, { width: 1440, height: 960 })
})

test('mergeSessionState can update repository metadata without replacing project tabs', async () => {
  const { mergeSessionState } = await loadSessionStore()
  const current = {
    repositoryPath: '/repo-a',
    selectedPath: 'README.md',
    openFileTabs: [{ path: 'README.md', name: 'README.md' }],
    expandedPaths: [''],
    projectSessions: {
      '/repo-b': {
        repositoryPath: '/repo-b',
        selectedPath: 'guide.md',
        activeFilePath: 'guide.md',
        openFileTabs: [{ path: 'guide.md', name: 'guide.md' }],
        expandedPaths: ['', 'docs']
      }
    },
    recentRepositories: [],
    recentFiles: []
  }

  const next = mergeSessionState(
    current,
    {
      repositoryPath: '/repo-b',
      rootPath: '/repo-b',
      activeRef: 'main',
      source: 'working-tree',
      selectedPath: '',
      activeFilePath: undefined,
      activeFileTabId: undefined,
      openFileTabs: [],
      expandedPaths: ['']
    },
    { syncProjectSession: false }
  )

  assert.equal(next.repositoryPath, '/repo-b')
  assert.deepEqual(next.openFileTabs, [])
  assert.deepEqual(next.projectSessions['/repo-b'].openFileTabs, [
    {
      path: 'guide.md',
      name: 'guide.md',
      history: [{ path: 'guide.md', name: 'guide.md' }],
      historyIndex: 0
    }
  ])
})

test('getOpenFileTabsForRecentFile resets tabs when switching repositories', async () => {
  const { getOpenFileTabsForRecentFile } = await loadSessionStore()
  const tabs = getOpenFileTabsForRecentFile({
    currentRepositoryPath: '/repo-a',
    nextRepositoryPath: '/repo-b',
    currentTabs: [{ path: 'old.md', name: 'old.md' }],
    nextTab: { path: 'docs/new.md', name: 'new.md' }
  })

  assert.deepEqual(tabs, [
    {
      path: 'docs/new.md',
      name: 'new.md',
      history: [{ path: 'docs/new.md', name: 'new.md' }],
      historyIndex: 0
    }
  ])
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
    {
      path: 'old.md',
      name: 'old.md',
      history: [{ path: 'old.md', name: 'old.md' }],
      historyIndex: 0
    },
    {
      path: 'docs/new.md',
      name: 'new.md',
      history: [{ path: 'docs/new.md', name: 'new.md' }],
      historyIndex: 0
    }
  ])
})
