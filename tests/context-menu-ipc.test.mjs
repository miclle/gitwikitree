/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadContextMenuIpc() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/context-menu-ipc.ts',
    modules: ['src/main/context-menu-ipc.ts', 'src/main/context-menu.ts', 'src/shared/types.ts']
  })
  return module
}

function createHarness(targetWindow = { id: 'target-window' }) {
  const handlers = new Map()
  const openedWindows = []
  const popups = []
  const item = {
    repoPath: '/repo',
    rootPath: '/repo',
    activeRef: 'main',
    source: 'working-tree',
    path: 'docs/guide.md',
    name: 'guide.md',
    type: 'file'
  }

  return {
    handlers,
    item,
    openedWindows,
    popups,
    dependencies: {
      ipcMain: {
        handle: (channel, handler) => {
          handlers.set(channel, handler)
        }
      },
      getWindowFromWebContents: () => targetWindow,
      buildMenuFromTemplate: (items) => ({
        popup: (options) => popups.push({ items, options })
      }),
      openTreeItemInNewWindow: (targetItem) => openedWindows.push(targetItem)
    }
  }
}

test('registerContextMenuIpcHandlers registers the tree item context menu channel', async () => {
  const { registerContextMenuIpcHandlers } = await loadContextMenuIpc()
  const { handlers, dependencies } = createHarness()

  registerContextMenuIpcHandlers(dependencies)

  assert.deepEqual([...handlers.keys()], ['context-menu:tree-item'])
})

test('context-menu:tree-item builds and opens a menu for the sender window', async () => {
  const { registerContextMenuIpcHandlers } = await loadContextMenuIpc()
  const { handlers, item, popups, openedWindows, dependencies } = createHarness()
  const sender = { send: () => undefined }

  registerContextMenuIpcHandlers(dependencies)
  handlers.get('context-menu:tree-item')({ sender }, item)

  assert.equal(popups.length, 1)
  assert.deepEqual(
    popups[0].items.map((menuItem) => menuItem.label),
    ['Open in New Tab', 'Open in New Window']
  )
  assert.deepEqual(popups[0].options, { window: { id: 'target-window' } })

  popups[0].items[1].click()
  assert.deepEqual(openedWindows, [item])
})

test('context-menu:tree-item does nothing when the sender window is gone', async () => {
  const { registerContextMenuIpcHandlers } = await loadContextMenuIpc()
  const { handlers, item, popups, dependencies } = createHarness(null)

  registerContextMenuIpcHandlers(dependencies)
  handlers.get('context-menu:tree-item')({ sender: { send: () => undefined } }, item)

  assert.deepEqual(popups, [])
})
