/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadContextMenu() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/context-menu.ts',
    modules: ['src/main/context-menu.ts', 'src/shared/types.ts'],
    prefix: 'gitwikitree-context-menu-test-'
  })
  return module
}

test('tree item context menu exposes new tab and new window actions', async () => {
  const { createTreeItemContextMenuItems } = await loadContextMenu()
  const sentMessages = []
  const openedWindows = []
  const item = {
    repoPath: '/repo',
    rootPath: '/repo',
    activeRef: 'main',
    source: 'working-tree',
    path: 'docs/guide.md',
    name: 'guide.md',
    type: 'file'
  }

  const items = createTreeItemContextMenuItems({
    item,
    sender: {
      send: (channel, payload) => sentMessages.push({ channel, payload })
    },
    openInNewWindow: (payload) => openedWindows.push(payload)
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['Open in New Tab', 'Open in New Window']
  )

  items[0].click()
  items[1].click()

  assert.deepEqual(sentMessages, [
    { channel: 'tree-item:open-in-new-tab', payload: 'docs/guide.md' }
  ])
  assert.deepEqual(openedWindows, [item])
})
