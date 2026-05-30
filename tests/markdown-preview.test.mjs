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
      href === '../assets/diagram.png' ? 'data:image/png;base64,ZmFrZQ==' : undefined,
    resolveImagePath: (href) =>
      href === '../assets/diagram.png' ? 'content/assets/diagram.png' : undefined,
    resolveImageAbsolutePath: (href) =>
      href === '../assets/diagram.png' ? '/Users/test/repo/content/assets/diagram.png' : undefined
  })

  assert.equal(
    html,
    '<p><img src="data:image/png;base64,ZmFrZQ==" data-preview-image-src="content/assets/diagram.png" data-preview-image-absolute-src="/Users/test/repo/content/assets/diagram.png" alt="Diagram" title="Overview"></p>\n'
  )
})

test('markdownToHtml resolves raw HTML image sources for embedded previews', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('<img width="120" alt="Diagram" src="../assets/diagram.png" />', {
    resolveImageSrc: (href) =>
      href === '../assets/diagram.png' ? 'data:image/png;base64,ZmFrZQ==' : undefined,
    resolveImagePath: (href) =>
      href === '../assets/diagram.png' ? 'content/assets/diagram.png' : undefined,
    resolveImageAbsolutePath: (href) =>
      href === '../assets/diagram.png' ? '/Users/test/repo/content/assets/diagram.png' : undefined
  })

  assert.equal(
    html,
    '<img width="120" alt="Diagram" src="data:image/png;base64,ZmFrZQ==" data-preview-image-src="content/assets/diagram.png" data-preview-image-absolute-src="/Users/test/repo/content/assets/diagram.png" />'
  )
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

test('markdownToHtml marks Mermaid code fences for diagram rendering', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml('```mermaid\ngraph TD\n  A[Start] --> B[Done]\n```')

  assert.equal(
    html,
    '<div class="mermaid-preview" data-mermaid-source="true">graph TD\n  A[Start] --&gt; B[Done]</div>\n'
  )
})

test('markdownToHtml normalizes state diagrams with display labels in state references', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml(`\`\`\`mermaid
stateDiagram
  direction TB

  [*] --> Preparing（准备中）: 准备中
  Preparing（准备中） --> Booting（开机中）: 导入镜像/准备网络
  Booting（开机中） --> Running（运行中）: 开机成功
  Running（运行中） --> Destroyed（已销毁）: 销毁
  Destroyed（已销毁） --> [*]
\`\`\``)

  assert.equal(
    html,
    '<div class="mermaid-preview" data-mermaid-source="true">stateDiagram\n' +
      '  direction TB\n' +
      '  state &quot;Preparing（准备中）&quot; as Preparing\n' +
      '  state &quot;Booting（开机中）&quot; as Booting\n' +
      '  state &quot;Running（运行中）&quot; as Running\n' +
      '  state &quot;Destroyed（已销毁）&quot; as Destroyed\n' +
      '\n' +
      '  [*] --&gt; Preparing: 准备中\n' +
      '  Preparing --&gt; Booting: 导入镜像/准备网络\n' +
      '  Booting --&gt; Running: 开机成功\n' +
      '  Running --&gt; Destroyed: 销毁\n' +
      '  Destroyed --&gt; [*]</div>\n'
  )
})

test('markdownToHtml preserves existing state declarations and transition labels', async () => {
  const { markdownToHtml } = await loadMarkdownPreview()
  const html = markdownToHtml(`\`\`\`mermaid
stateDiagram
  state "Running（运行中）" as Running
  Running --> Shutdown（已关机）: 从 Running（运行中）关机
\`\`\``)

  assert.equal(
    html,
    '<div class="mermaid-preview" data-mermaid-source="true">stateDiagram\n' +
      '  state &quot;Shutdown（已关机）&quot; as Shutdown\n' +
      '  state &quot;Running（运行中）&quot; as Running\n' +
      '  Running --&gt; Shutdown: 从 Running（运行中）关机</div>\n'
  )
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
