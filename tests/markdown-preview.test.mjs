/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function loadMarkdownPreview() {
  const source = await readFile(
    new URL('../src/renderer/src/markdown-preview.ts', import.meta.url),
    'utf8'
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    }
  })

  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(outputText)}`)
}

test('getMarkdownPreview extracts a quoted front matter title and removes metadata', async () => {
  const { getMarkdownPreview } = await loadMarkdownPreview()
  const preview = getMarkdownPreview(`---
title: "模块功能及状态"
---

正文内容`)

  assert.equal(preview.title, '模块功能及状态')
  assert.equal(preview.content, '正文内容')
})

test('getMarkdownPreview leaves markdown without front matter unchanged', async () => {
  const { getMarkdownPreview } = await loadMarkdownPreview()
  const preview = getMarkdownPreview('# Existing title\n\n正文内容')

  assert.equal(preview.title, undefined)
  assert.equal(preview.content, '# Existing title\n\n正文内容')
})

test('getMarkdownPreview does not duplicate a front matter title already used as first heading', async () => {
  const { getMarkdownPreview } = await loadMarkdownPreview()
  const preview = getMarkdownPreview(`---
title: "模块功能及状态"
---

# 模块功能及状态

正文内容`)

  assert.equal(preview.title, undefined)
  assert.equal(preview.content, '# 模块功能及状态\n\n正文内容')
})

test('markdownToHtml marks links so the preview can intercept clicks', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('[Design doc](docs/design.md)')

  assert.equal(html, '<p><a href="docs/design.md" data-markdown-link="true">Design doc</a></p>')
})

test('resolveMarkdownLinkPath resolves repository-relative markdown links', async () => {
  const { resolveMarkdownLinkPath } = await loadMarkdownPreview()

  assert.equal(
    resolveMarkdownLinkPath('../assets/logo.svg#preview', 'docs/guide/intro.md'),
    'docs/assets/logo.svg'
  )
  assert.equal(resolveMarkdownLinkPath('/README.md', 'docs/guide/intro.md'), 'README.md')
  assert.equal(
    resolveMarkdownLinkPath('space%20name.md', 'docs/guide/intro.md'),
    'docs/guide/space name.md'
  )
})

test('resolveMarkdownLinkPath ignores external, hash, and root-escaping links', async () => {
  const { resolveMarkdownLinkPath } = await loadMarkdownPreview()

  assert.equal(resolveMarkdownLinkPath('https://example.com', 'docs/guide/intro.md'), undefined)
  assert.equal(resolveMarkdownLinkPath('#section', 'docs/guide/intro.md'), undefined)
  assert.equal(resolveMarkdownLinkPath('../../outside.md', 'intro.md'), undefined)
})
