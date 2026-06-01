/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadContextMenu() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/context-menu.ts',
    modules: [
      'src/main/context-menu.ts',
      'src/main/menu-i18n.ts',
      'src/main/repository-paths.ts',
      'src/main/browser-context-menu.ts',
      'src/shared/types.ts'
    ],
    prefix: 'gitwikitree-context-menu-test-'
  })
  return module
}

test('tree item context menu exposes new tab and new window actions', async () => {
  const { createTreeItemContextMenuItems } = await loadContextMenu()
  const sentMessages = []
  const openedWindows = []
  const copiedText = []
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
    openInNewWindow: (payload) => openedWindows.push(payload),
    writeClipboardText: (text) => copiedText.push(text)
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['Open in New Tab', 'Open in New Window', 'Copy Path']
  )

  items[0].click()
  items[1].click()
  items[2].click()

  assert.deepEqual(sentMessages, [
    { channel: 'tree-item:open-in-new-tab', payload: 'docs/guide.md' }
  ])
  assert.deepEqual(openedWindows, [item])
  assert.deepEqual(copiedText, ['/repo/docs/guide.md'])
})

test('tree item context menu localizes actions', async () => {
  const { createTreeItemContextMenuItems } = await loadContextMenu()
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
    language: 'zh-CN',
    sender: {
      send: () => undefined
    },
    openInNewWindow: () => undefined,
    writeClipboardText: () => undefined
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['在新标签中打开', '在新窗口中打开', '复制路径']
  )
})

test('external markdown link context menu opens only in the system browser', async () => {
  const { createMarkdownLinkContextMenuItems } = await loadContextMenu()
  const sentMessages = []
  const openedExternal = []
  const copiedText = []

  const items = createMarkdownLinkContextMenuItems({
    item: {
      kind: 'external',
      href: 'https://example.com/docs'
    },
    sender: {
      send: (channel, payload) => sentMessages.push({ channel, payload })
    },
    openExternal: (url) => openedExternal.push(url),
    writeClipboardText: (text) => copiedText.push(text),
    openInNewWindow: () => undefined
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['Open Link', 'Copy Link Address']
  )

  items[0].click()
  items[1].click()

  assert.deepEqual(openedExternal, ['https://example.com/docs'])
  assert.deepEqual(copiedText, ['https://example.com/docs'])
  assert.deepEqual(sentMessages, [])
})

test('external markdown link context menu disables unsafe protocols', async () => {
  const { createMarkdownLinkContextMenuItems } = await loadContextMenu()
  const openedExternal = []
  const copiedText = []

  const items = createMarkdownLinkContextMenuItems({
    item: {
      kind: 'external',
      href: 'javascript:alert(1)'
    },
    sender: {
      send: () => undefined
    },
    openExternal: (url) => openedExternal.push(url),
    writeClipboardText: (text) => copiedText.push(text),
    openInNewWindow: () => undefined
  })

  assert.equal(items[0].label, 'Open Link')
  assert.equal(items[0].enabled, false)

  items[0].click()
  items[1].click()

  assert.deepEqual(openedExternal, [])
  assert.deepEqual(copiedText, ['javascript:alert(1)'])
})

test('unresolved markdown link context menu offers copy only', async () => {
  const { createMarkdownLinkContextMenuItems } = await loadContextMenu()
  const sentMessages = []
  const copiedText = []

  const items = createMarkdownLinkContextMenuItems({
    item: {
      kind: 'unresolved',
      href: '../../outside.md'
    },
    sender: {
      send: (channel, payload) => sentMessages.push({ channel, payload })
    },
    openExternal: () => undefined,
    writeClipboardText: (text) => copiedText.push(text),
    openInNewWindow: () => undefined
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['Copy Link Address']
  )

  items[0].click()

  assert.deepEqual(copiedText, ['../../outside.md'])
  assert.deepEqual(sentMessages, [])
})

test('internal markdown link context menu opens in the app', async () => {
  const { createMarkdownLinkContextMenuItems } = await loadContextMenu()
  const sentMessages = []
  const copiedText = []
  const openedWindows = []
  const item = {
    kind: 'internal',
    href: '../guide.md#install',
    targetPath: 'docs/guide.md',
    targetName: 'guide.md',
    targetType: 'file',
    hash: 'install',
    repoPath: '/repo',
    rootPath: '/repo',
    activeRef: 'main',
    source: 'working-tree'
  }

  const items = createMarkdownLinkContextMenuItems({
    item,
    sender: {
      send: (channel, payload) => sentMessages.push({ channel, payload })
    },
    openExternal: () => undefined,
    writeClipboardText: (text) => copiedText.push(text),
    openInNewWindow: (targetItem) => openedWindows.push(targetItem)
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label ?? menuItem.type),
    ['Open Link', 'Open in New Tab', 'Open in New Window', 'separator', 'Copy Link Address']
  )

  items[0].click()
  items[1].click()
  items[2].click()
  items[4].click()

  assert.deepEqual(sentMessages, [
    { channel: 'markdown-link:open', payload: { ...item, action: 'open' } },
    { channel: 'markdown-link:open', payload: { ...item, action: 'open-new-tab' } }
  ])
  assert.deepEqual(openedWindows, [
    {
      repoPath: '/repo',
      rootPath: '/repo',
      activeRef: 'main',
      source: 'working-tree',
      path: 'docs/guide.md',
      name: 'guide.md',
      type: 'file',
      anchor: 'install'
    }
  ])
  assert.deepEqual(copiedText, ['../guide.md#install'])
})

test('markdown link context menu localizes actions', async () => {
  const { createMarkdownLinkContextMenuItems } = await loadContextMenu()

  const items = createMarkdownLinkContextMenuItems({
    item: {
      kind: 'external',
      href: 'https://example.com/docs'
    },
    language: 'zh-CN',
    sender: {
      send: () => undefined
    },
    openExternal: () => undefined,
    writeClipboardText: () => undefined,
    openInNewWindow: () => undefined
  })

  assert.deepEqual(
    items.map((menuItem) => menuItem.label),
    ['打开链接', '复制链接地址']
  )
})
