/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadMarkdownPreview() {
  const { module } = await loadTranspiledModule({
    entry: 'src/renderer/src/markdown-preview.ts',
    modules: ['src/renderer/src/markdown-preview.ts', 'src/renderer/src/code-highlight.ts']
  })
  return module
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

  assert.equal(html, '<p><a href="docs/design.md" data-markdown-link="true">Design doc</a></p>\n')
})

test('markdownToHtml resolves image sources for embedded previews', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('![Diagram](../assets/diagram.png "Overview")', {
    resolveImageSrc: (href) =>
      href === '../assets/diagram.png' ? 'data:image/png;base64,ZmFrZQ==' : undefined
  })

  assert.equal(
    html,
    '<p><img src="data:image/png;base64,ZmFrZQ==" alt="Diagram" title="Overview"></p>\n'
  )
})

test('markdownToHtml resolves raw HTML image sources for embedded previews', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('<img width="120" alt="Diagram" src="../assets/diagram.png" />', {
    resolveImageSrc: (href) =>
      href === '../assets/diagram.png' ? 'data:image/png;base64,ZmFrZQ==' : undefined
  })

  assert.equal(html, '<img width="120" alt="Diagram" src="data:image/png;base64,ZmFrZQ==" />')
})

test('markdownToHtml adds stable heading ids for anchor links', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('# Getting Started\n\n## Getting Started\n\n## API `Reference`')

  assert.equal(
    html,
    '<h1 id="getting-started">Getting Started</h1>\n<h2 id="getting-started-1">Getting Started</h2>\n<h2 id="api-reference">API <code>Reference</code></h2>\n'
  )
})

test('markdownToHtml renders GitHub flavored markdown and highlighted code blocks', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('- [x] Done\n\n```ts\nconst ok = true\n```')

  assert.match(html, /<input checked="" disabled="" type="checkbox">/)
  assert.match(html, /<button type="button" class="markdown-code-copy" data-copy-code="true"/)
  assert.match(html, /<code class="hljs language-ts">/)
  assert.match(html, /<span class="hljs-keyword">const<\/span>/)
})

test('markdownHeadingId preserves non-Latin heading text', async () => {
  const { markdownHeadingId } = await loadMarkdownPreview()

  assert.equal(markdownHeadingId('模块功能及状态'), '模块功能及状态')
  assert.equal(markdownHeadingId('API `Reference`'), 'api-reference')
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
