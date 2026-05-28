/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAppNavigation() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/app-navigation.ts')
  return module
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
