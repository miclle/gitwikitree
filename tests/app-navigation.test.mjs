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
