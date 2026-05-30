/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadPreviewDetection() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/preview-detection.ts',
    modules: ['src/main/preview-detection.ts', 'src/shared/types.ts']
  })
  return module
}

test('detectPreviewType treats unknown text content as text', async () => {
  const { detectPreviewType } = await loadPreviewDetection()

  assert.equal(
    detectPreviewType('.service', Buffer.from('[Service]\nExecStart=/usr/bin/app\n')),
    'text'
  )
  assert.equal(
    detectPreviewType('.mod', Buffer.from('module example.com/app\n\ngo 1.23\n')),
    'text'
  )
  assert.equal(detectPreviewType('.sum', Buffer.from('example.com/mod v1.0.0 h1:abcdef\n')), 'text')
})

test('detectPreviewType keeps binary-looking unknown content unsupported', async () => {
  const { detectPreviewType } = await loadPreviewDetection()

  assert.equal(detectPreviewType('.bin', Buffer.from([0x89, 0x00, 0xff, 0x10])), 'unsupported')
})

test('detectPreviewType treats PDF files as PDF previews', async () => {
  const { detectPreviewType } = await loadPreviewDetection()

  assert.equal(detectPreviewType('.pdf'), 'pdf')
})
