import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('directory preview constrains material tree icons to row-sized glyphs', async () => {
  const css = await readFile(
    new URL('../src/renderer/src/assets/main.css', import.meta.url),
    'utf8'
  )

  assert.match(css, /\.directory-list\s+\.tree-icon\s*\{[^}]*width:\s*16px;/s)
  assert.match(css, /\.directory-list\s+\.tree-icon\s*\{[^}]*height:\s*16px;/s)
})
