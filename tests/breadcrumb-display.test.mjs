/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadBreadcrumbDisplay() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/breadcrumb-display.ts')
  return module
}

test('getDirectoryReadmeBreadcrumbSource returns the rendered directory index file', async () => {
  const { getDirectoryReadmeBreadcrumbSource } = await loadBreadcrumbDisplay()

  assert.deepEqual(
    getDirectoryReadmeBreadcrumbSource({
      kind: 'directory',
      path: 'docs',
      readme: { path: 'docs/README.md', content: '# Docs' }
    }),
    { name: 'README.md', path: 'docs/README.md' }
  )
})

test('getDirectoryReadmeBreadcrumbSource ignores directories without index content', async () => {
  const { getDirectoryReadmeBreadcrumbSource } = await loadBreadcrumbDisplay()

  assert.equal(
    getDirectoryReadmeBreadcrumbSource({
      kind: 'directory',
      path: 'docs',
      entries: [{ name: 'guide.md', path: 'docs/guide.md', type: 'file' }]
    }),
    undefined
  )
})

test('getDirectoryReadmeBreadcrumbSource ignores file previews', async () => {
  const { getDirectoryReadmeBreadcrumbSource } = await loadBreadcrumbDisplay()

  assert.equal(
    getDirectoryReadmeBreadcrumbSource({
      kind: 'file',
      path: 'docs/guide.md',
      name: 'guide.md',
      extension: '.md',
      previewType: 'markdown',
      editable: true,
      size: 12
    }),
    undefined
  )
})
