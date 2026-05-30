/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadPdfPreview() {
  const { module } = await loadTranspiledModule({
    entry: 'src/renderer/src/pdf-preview.ts',
    modules: ['src/renderer/src/pdf-preview.ts']
  })
  return module
}

test('pdfDataUrlToBytes decodes base64 PDF data URLs', async () => {
  const { pdfDataUrlToBytes } = await loadPdfPreview()
  const bytes = pdfDataUrlToBytes('data:application/pdf;base64,JVBERi0xLjcK')

  assert.deepEqual([...bytes], [...Buffer.from('%PDF-1.7\n')])
})

test('pdfDataUrlToBytes rejects non-PDF data URLs', async () => {
  const { pdfDataUrlToBytes } = await loadPdfPreview()

  assert.throws(() => pdfDataUrlToBytes('data:text/plain;base64,SGVsbG8='), /Invalid PDF data URL/)
})
