/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function loadPreviewDetection() {
  const source = await readFile(
    new URL('../src/main/preview-detection.ts', import.meta.url),
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
