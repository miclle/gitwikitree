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
