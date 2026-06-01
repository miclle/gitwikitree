/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule, loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAppNavigation() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/app-navigation.ts')
  return module
}

async function loadWorkspaceNavigation() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/workspace-navigation.ts',
    modules: [
      'src/renderer/src/workspace-navigation.ts',
      'src/renderer/src/app-navigation.ts',
      'src/shared/types.ts'
    ]
  })
  return { module, tempDir }
}

async function loadWorkspaceSessionRestore() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/workspace-session-restore.ts',
    modules: [
      'src/renderer/src/workspace-session-restore.ts',
      'src/renderer/src/workspace-paths.ts',
      'src/renderer/src/repository-navigation.ts',
      'src/shared/types.ts'
    ]
  })
  return { module, tempDir }
}

async function loadWorkspacePreviewNavigation() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/workspace-preview-navigation.ts',
    modules: [
      'src/renderer/src/workspace-preview-navigation.ts',
      'src/renderer/src/workspace-navigation.ts',
      'src/renderer/src/workspace-paths.ts',
      'src/renderer/src/repository-navigation.ts',
      'src/renderer/src/app-navigation.ts',
      'src/shared/types.ts'
    ]
  })
  return { module, tempDir }
}

test('navigateFileTabs replaces the active tab for ordinary navigation and records history', async () => {
  const { navigateFileTabs } = await loadAppNavigation()
  const initialTabs = [
    {
      id: 'tab-readme',
      path: 'README.md',
      name: 'README.md',
      history: [{ path: 'README.md', name: 'README.md' }],
      historyIndex: 0
    }
  ]

  const next = navigateFileTabs({
    tabs: initialTabs,
    activeTabId: 'tab-readme',
    target: { path: 'docs/guide.md', name: 'guide.md' },
    openInNewTab: false,
    nextTabId: 'tab-guide'
  })

  assert.equal(next.activeTabId, 'tab-readme')
  assert.deepEqual(next.tabs, [
    {
      id: 'tab-readme',
      path: 'docs/guide.md',
      name: 'guide.md',
      history: [
        { path: 'README.md', name: 'README.md' },
        { path: 'docs/guide.md', name: 'guide.md' }
      ],
      historyIndex: 1
    }
  ])
})

test('navigateFileTabs opens a new tab for explicit new-tab navigation', async () => {
  const { navigateFileTabs } = await loadAppNavigation()
  const initialTabs = [
    {
      id: 'tab-readme',
      path: 'README.md',
      name: 'README.md',
      history: [{ path: 'README.md', name: 'README.md' }],
      historyIndex: 0
    }
  ]

  const next = navigateFileTabs({
    tabs: initialTabs,
    activeTabId: 'tab-readme',
    target: { path: 'docs/guide.md', name: 'guide.md' },
    openInNewTab: true,
    nextTabId: 'tab-guide'
  })

  assert.equal(next.activeTabId, 'tab-guide')
  assert.deepEqual(
    next.tabs.map((tab) => tab.path),
    ['README.md', 'docs/guide.md']
  )
})

test('moveActiveTabHistory navigates backward and forward within the active tab', async () => {
  const { moveActiveTabHistory } = await loadAppNavigation()
  const tabs = [
    {
      id: 'tab-readme',
      path: 'docs/guide.md',
      name: 'guide.md',
      history: [
        { path: 'README.md', name: 'README.md' },
        { path: 'docs/guide.md', name: 'guide.md' }
      ],
      historyIndex: 1
    }
  ]

  const back = moveActiveTabHistory(tabs, 'tab-readme', -1)
  assert.deepEqual(back.target, { path: 'README.md', name: 'README.md' })
  assert.equal(back.tabs[0].historyIndex, 0)

  const forward = moveActiveTabHistory(back.tabs, 'tab-readme', 1)
  assert.deepEqual(forward.target, { path: 'docs/guide.md', name: 'guide.md' })
  assert.equal(forward.tabs[0].historyIndex, 1)
})

test('getFileTabForShortcutPosition maps 1-8 to tab positions and 9 to the last tab', async () => {
  const { getFileTabForShortcutPosition } = await loadAppNavigation()
  const tabs = Array.from({ length: 10 }, (_, index) => ({
    id: `tab-${index + 1}`,
    path: `file-${index + 1}.md`,
    name: `file-${index + 1}.md`,
    history: [{ path: `file-${index + 1}.md`, name: `file-${index + 1}.md` }],
    historyIndex: 0
  }))

  assert.equal(getFileTabForShortcutPosition(tabs, 1)?.id, 'tab-1')
  assert.equal(getFileTabForShortcutPosition(tabs, 8)?.id, 'tab-8')
  assert.equal(getFileTabForShortcutPosition(tabs, 9)?.id, 'tab-10')
  assert.equal(getFileTabForShortcutPosition(tabs, 0), undefined)
  assert.equal(getFileTabForShortcutPosition(tabs.slice(0, 3), 8), undefined)
})

test('getAdjacentFileTab moves left and right from the active tab', async () => {
  const { getAdjacentFileTab } = await loadAppNavigation()
  const tabs = ['tab-a', 'tab-b', 'tab-c'].map((id) => ({
    id,
    path: `${id}.md`,
    name: `${id}.md`,
    history: [{ path: `${id}.md`, name: `${id}.md` }],
    historyIndex: 0
  }))

  assert.equal(getAdjacentFileTab(tabs, 'tab-b', -1)?.id, 'tab-a')
  assert.equal(getAdjacentFileTab(tabs, 'tab-b', 1)?.id, 'tab-c')
  assert.equal(getAdjacentFileTab(tabs, 'tab-a', -1)?.id, 'tab-c')
  assert.equal(getAdjacentFileTab(tabs, 'tab-c', 1)?.id, 'tab-a')
  assert.equal(getAdjacentFileTab(tabs, 'tab-missing', 1), undefined)
  assert.equal(getAdjacentFileTab(tabs.slice(0, 1), 'tab-a', 1), undefined)
})

test('createWorkspaceNavigationPatch keeps tab and selected-file state together', async () => {
  const { module } = await loadWorkspaceNavigation()
  const initialTabs = [
    {
      id: 'tab-readme',
      path: 'README.md',
      name: 'README.md',
      type: 'file',
      history: [{ path: 'README.md', name: 'README.md', type: 'file' }],
      historyIndex: 0
    }
  ]

  const next = module.createWorkspaceNavigationPatch({
    openFileTabs: initialTabs,
    activeFileTabId: 'tab-readme',
    target: { path: 'docs', name: 'docs', type: 'directory' },
    openInNewTab: false,
    nextTabId: 'tab-docs'
  })

  assert.equal(next.selectedPath, 'docs')
  assert.equal(next.activeFilePath, undefined)
  assert.equal(next.activeFileTabId, 'tab-readme')
  assert.deepEqual(
    next.openFileTabs[0].history.map((item) => item.path),
    ['README.md', 'docs']
  )
})

test('createCloseFileTabPatch selects the adjacent tab when closing the active tab', async () => {
  const { module } = await loadWorkspaceNavigation()
  const tabs = [
    {
      id: 'tab-readme',
      path: 'README.md',
      name: 'README.md',
      type: 'file',
      history: [{ path: 'README.md', name: 'README.md', type: 'file' }],
      historyIndex: 0
    },
    {
      id: 'tab-docs',
      path: 'docs',
      name: 'docs',
      type: 'directory',
      history: [{ path: 'docs', name: 'docs', type: 'directory' }],
      historyIndex: 0
    }
  ]

  const next = module.createCloseFileTabPatch({
    openFileTabs: tabs,
    activeFileTabId: 'tab-readme',
    closingTabId: 'tab-readme'
  })

  assert.equal(next.selectedPath, 'docs')
  assert.equal(next.activeFilePath, undefined)
  assert.equal(next.activeFileTabId, 'tab-docs')
  assert.equal(next.previewPath, 'docs')
  assert.deepEqual(
    next.openFileTabs.map((tab) => tab.id),
    ['tab-docs']
  )
})

test('mergeOpenedFileTab preserves current tabs while replacing duplicate paths', async () => {
  const { module } = await loadWorkspaceNavigation()
  const currentTabs = [
    {
      id: 'tab-old-readme',
      path: 'README.md',
      name: 'README.md',
      type: 'file',
      history: [{ path: 'README.md', name: 'README.md', type: 'file' }],
      historyIndex: 0
    },
    {
      id: 'tab-docs',
      path: 'docs',
      name: 'docs',
      type: 'directory',
      history: [{ path: 'docs', name: 'docs', type: 'directory' }],
      historyIndex: 0
    }
  ]
  const openedTab = {
    id: 'tab-new-readme',
    path: 'README.md',
    name: 'README.md',
    type: 'file',
    history: [{ path: 'README.md', name: 'README.md', type: 'file' }],
    historyIndex: 0
  }

  assert.deepEqual(
    module.mergeOpenedFileTab(currentTabs, openedTab).map((tab) => tab.id),
    ['tab-docs', 'tab-new-readme']
  )
})

test('createRestoredRepositorySession resolves tabs and expands active ancestors', async () => {
  const { module } = await loadWorkspaceSessionRestore()
  const repository = {
    name: 'wiki',
    path: '/repo',
    rootPath: '/repo',
    branch: 'main',
    activeRef: 'main',
    source: 'working-tree',
    editable: true,
    refs: [],
    tree: [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [{ name: 'guide.md', path: 'docs/guide.md', type: 'file' }]
      }
    ]
  }
  const session = {
    selectedPath: 'missing.md',
    activeFilePath: 'docs/guide.md',
    activeFileTabId: 'guide-tab',
    expandedPaths: [],
    openFileTabs: [
      {
        id: 'missing-tab',
        path: 'missing.md',
        name: 'missing.md',
        history: [{ path: 'missing.md', name: 'missing.md', type: 'file' }],
        historyIndex: 0
      },
      {
        id: 'guide-tab',
        path: 'docs/guide.md',
        name: 'old-name.md',
        history: [
          { path: 'README.md', name: 'README.md', type: 'file' },
          { path: 'docs/guide.md', name: 'old-name.md', type: 'file' }
        ],
        historyIndex: 1
      }
    ]
  }

  const restored = module.createRestoredRepositorySession(repository, session)

  assert.equal(restored.selectedPath, 'docs/guide.md')
  assert.equal(restored.activeFilePath, 'docs/guide.md')
  assert.equal(restored.activeFileTabId, 'guide-tab')
  assert.deepEqual(
    restored.openFileTabs.map((tab) => tab.path),
    ['docs/guide.md']
  )
  assert.deepEqual(
    restored.openFileTabs[0].history.map((item) => item.path),
    ['README.md', 'docs/guide.md']
  )
  assert.deepEqual([...restored.expandedPaths], ['', 'docs'])
})

test('createPreviewPathNavigation resolves preview paths into tree or tab actions', async () => {
  const { module } = await loadWorkspacePreviewNavigation()
  const repository = {
    name: 'wiki',
    path: '/repo',
    rootPath: '/repo',
    branch: 'main',
    activeRef: 'main',
    source: 'working-tree',
    editable: true,
    refs: [],
    tree: [
      {
        name: 'docs',
        path: 'docs',
        type: 'directory',
        children: [{ name: 'guide.md', path: 'docs/guide.md', type: 'file' }]
      }
    ]
  }
  const openFileTabs = [
    {
      id: 'tab-readme',
      path: 'README.md',
      name: 'README.md',
      type: 'file',
      history: [{ path: 'README.md', name: 'README.md', type: 'file' }],
      historyIndex: 0
    }
  ]

  const fileNavigation = module.createPreviewPathNavigation({
    repository,
    path: 'docs/guide.md',
    openInNewTab: true,
    activeFileTabId: 'tab-readme',
    openFileTabs,
    nextTabId: 'tab-guide',
    expandAncestors: true
  })

  assert.equal(fileNavigation.kind, 'node')
  assert.equal(fileNavigation.node.path, 'docs/guide.md')
  assert.deepEqual(fileNavigation.expandedPaths, ['', 'docs'])

  const rootNavigation = module.createPreviewPathNavigation({
    repository,
    path: '',
    openInNewTab: false,
    activeFileTabId: 'tab-readme',
    openFileTabs,
    nextTabId: 'tab-root',
    expandAncestors: false
  })

  assert.equal(rootNavigation.kind, 'patch')
  assert.equal(rootNavigation.previewPath, '')
  assert.equal(rootNavigation.patch.selectedPath, '')
  assert.equal(rootNavigation.patch.activeFileTabId, 'tab-readme')

  assert.deepEqual(
    module.createPreviewPathNavigation({
      repository,
      path: 'missing.md',
      openInNewTab: false,
      activeFileTabId: 'tab-readme',
      openFileTabs,
      nextTabId: 'tab-missing',
      expandAncestors: true
    }),
    { kind: 'missing' }
  )
})
