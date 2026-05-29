/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadMarkdownLinkContext() {
  const { module } = await loadTranspiledModule({
    entry: 'src/renderer/src/markdown-link-context.ts',
    modules: [
      'src/renderer/src/markdown-link-context.ts',
      'src/renderer/src/markdown-preview.ts',
      'src/renderer/src/code-highlight.ts'
    ]
  })
  return module
}

test('createMarkdownLinkTarget classifies external links', async () => {
  const { createMarkdownLinkTarget } = await loadMarkdownLinkContext()

  assert.deepEqual(
    createMarkdownLinkTarget({
      href: 'https://example.com/docs',
      sourcePath: 'docs/intro.md',
      previewPath: 'docs/intro.md'
    }),
    {
      kind: 'external',
      href: 'https://example.com/docs'
    }
  )
})

test('createMarkdownLinkTarget resolves internal links and preserves hash anchors', async () => {
  const { createMarkdownLinkTarget } = await loadMarkdownLinkContext()

  assert.deepEqual(
    createMarkdownLinkTarget({
      href: '../guide.md#install',
      sourcePath: 'docs/intro/start.md',
      previewPath: 'docs/intro/start.md'
    }),
    {
      kind: 'internal',
      href: '../guide.md#install',
      targetPath: 'docs/guide.md',
      hash: 'install'
    }
  )
})

test('createMarkdownLinkTarget keeps pure anchor links on the current preview path', async () => {
  const { createMarkdownLinkTarget } = await loadMarkdownLinkContext()

  assert.deepEqual(
    createMarkdownLinkTarget({
      href: '#模块功能',
      sourcePath: 'README.md',
      previewPath: ''
    }),
    {
      kind: 'anchor',
      href: '#模块功能',
      targetPath: '',
      hash: '模块功能'
    }
  )
})

test('createMarkdownLinkTarget preserves unresolved markdown links for context menus', async () => {
  const { createMarkdownLinkTarget } = await loadMarkdownLinkContext()

  assert.deepEqual(
    createMarkdownLinkTarget({
      href: '../../outside.md',
      sourcePath: 'intro.md',
      previewPath: 'intro.md'
    }),
    {
      kind: 'unresolved',
      href: '../../outside.md'
    }
  )
})
