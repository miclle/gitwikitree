/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadBrowserContextMenu() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/browser-context-menu.ts',
    modules: ['src/main/browser-context-menu.ts', 'src/main/menu-i18n.ts', 'src/shared/types.ts']
  })
  return module
}

function createParams(overrides = {}) {
  return {
    x: 12,
    y: 24,
    linkURL: '',
    mediaType: 'none',
    hasImageContents: false,
    srcURL: '',
    isEditable: false,
    selectionText: '',
    editFlags: {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canDelete: false,
      canSelectAll: true
    },
    ...overrides
  }
}

function createActions() {
  const calls = []

  return {
    calls,
    actions: {
      openExternal: (url) => calls.push(['openExternal', url]),
      writeClipboardText: (text) => calls.push(['writeClipboardText', text]),
      copyImageAt: (x, y) => calls.push(['copyImageAt', x, y]),
      inspectElement: (x, y) => calls.push(['inspectElement', x, y])
    }
  }
}

test('canOpenExternalUrl allows only safe external protocols', async () => {
  const { canOpenExternalUrl } = await loadBrowserContextMenu()

  assert.equal(canOpenExternalUrl('https://example.com'), true)
  assert.equal(canOpenExternalUrl('http://example.com'), true)
  assert.equal(canOpenExternalUrl('mailto:test@example.com'), true)
  assert.equal(canOpenExternalUrl('file:///tmp/a'), false)
  assert.equal(canOpenExternalUrl('not a url'), false)
})

test('createBrowserContextMenuItems builds link and image actions', async () => {
  const { createBrowserContextMenuItems } = await loadBrowserContextMenu()
  const { actions, calls } = createActions()
  const items = createBrowserContextMenuItems({
    params: createParams({
      linkURL: 'https://example.com',
      mediaType: 'image',
      hasImageContents: true,
      srcURL: 'https://example.com/image.png'
    }),
    isDev: false,
    ...actions
  })

  assert.deepEqual(
    items.map((item) => item.label ?? item.role ?? item.type),
    [
      'Open Link',
      'Copy Link Address',
      'separator',
      'Copy Image',
      'Copy Image Path',
      'separator',
      'Copy',
      'Select All'
    ]
  )

  items[0].click()
  items[1].click()
  items[3].click()
  items[4].click()

  assert.deepEqual(calls, [
    ['openExternal', 'https://example.com'],
    ['writeClipboardText', 'https://example.com'],
    ['copyImageAt', 12, 24],
    ['writeClipboardText', 'https://example.com/image.png']
  ])
})

test('createBrowserContextMenuItems copies renderer-provided image paths', async () => {
  const { createBrowserContextMenuItems } = await loadBrowserContextMenu()
  const { actions, calls } = createActions()
  const items = createBrowserContextMenuItems({
    params: createParams({
      mediaType: 'image',
      hasImageContents: true,
      srcURL: 'data:image/png;base64,ZmFrZQ=='
    }),
    imageSourceURL: 'content/docs/assets/diagram.png',
    imageAbsoluteSourceURL: '/Users/test/repo/content/docs/assets/diagram.png',
    isDev: false,
    ...actions
  })

  items[1].click()
  items[2].click()

  assert.deepEqual(calls, [
    ['writeClipboardText', 'content/docs/assets/diagram.png'],
    ['writeClipboardText', '/Users/test/repo/content/docs/assets/diagram.png']
  ])
})

test('createBrowserContextMenuItems includes editable and inspect actions', async () => {
  const { createBrowserContextMenuItems } = await loadBrowserContextMenu()
  const { actions, calls } = createActions()
  const items = createBrowserContextMenuItems({
    params: createParams({
      isEditable: true,
      editFlags: {
        canUndo: true,
        canRedo: false,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: true,
        canSelectAll: true
      }
    }),
    isDev: true,
    ...actions
  })

  assert.deepEqual(
    items.map((item) => item.role ?? item.label ?? item.type),
    [
      'undo',
      'redo',
      'separator',
      'cut',
      'copy',
      'paste',
      'pasteAndMatchStyle',
      'delete',
      'separator',
      'selectAll',
      'separator',
      'Inspect Element'
    ]
  )

  items.at(-1).click()
  assert.deepEqual(calls, [['inspectElement', 12, 24]])
})

test('createBrowserContextMenuItems localizes browser actions', async () => {
  const { createBrowserContextMenuItems } = await loadBrowserContextMenu()
  const { actions } = createActions()
  const items = createBrowserContextMenuItems({
    params: createParams({
      linkURL: 'https://example.com',
      mediaType: 'image',
      hasImageContents: true,
      srcURL: 'https://example.com/image.png'
    }),
    language: 'zh-CN',
    isDev: true,
    ...actions
  })

  assert.deepEqual(
    items.map((item) => item.label ?? item.role ?? item.type),
    [
      '打开链接',
      '复制链接地址',
      'separator',
      '复制图片',
      '复制图片路径',
      'separator',
      '复制',
      '全选',
      'separator',
      '检查元素'
    ]
  )
})

test('createBrowserContextMenuItems localizes editable role actions', async () => {
  const { createBrowserContextMenuItems } = await loadBrowserContextMenu()
  const { actions } = createActions()
  const items = createBrowserContextMenuItems({
    params: createParams({
      isEditable: true,
      editFlags: {
        canUndo: true,
        canRedo: true,
        canCut: true,
        canCopy: true,
        canPaste: true,
        canDelete: true,
        canSelectAll: true
      }
    }),
    language: 'zh-CN',
    isDev: false,
    ...actions
  })

  assert.deepEqual(
    items.map((item) => item.label ?? item.role ?? item.type),
    [
      '撤销',
      '重做',
      'separator',
      '剪切',
      '复制',
      '粘贴',
      '粘贴并匹配样式',
      '删除',
      'separator',
      '全选'
    ]
  )
})
