/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadPreviewImages() {
  const { module } = await loadTranspiledModule({
    entry: 'src/renderer/src/preview-images.ts',
    modules: ['src/renderer/src/preview-images.ts']
  })
  return module
}

test('collectPreviewImages keeps display metadata for preview images', async () => {
  const { collectPreviewImages } = await loadPreviewImages()

  assert.deepEqual(
    collectPreviewImages([
      { src: 'data:image/png;base64,a', alt: ' Diagram ', title: ' Overview ' },
      { src: '', alt: 'Missing' }
    ]),
    [{ src: 'data:image/png;base64,a', alt: 'Diagram', title: 'Overview' }]
  )
})

test('getSteppedPreviewImageIndex wraps through image lists', async () => {
  const { getSteppedPreviewImageIndex } = await loadPreviewImages()

  assert.equal(getSteppedPreviewImageIndex(0, 3, -1), 2)
  assert.equal(getSteppedPreviewImageIndex(2, 3, 1), 0)
  assert.equal(getSteppedPreviewImageIndex(1, 3, 1), 2)
})

test('preview image zoom steps within useful bounds', async () => {
  const { getSteppedPreviewImageZoom, getToggledPreviewImageZoom } = await loadPreviewImages()

  assert.equal(getSteppedPreviewImageZoom(1, 0.25), 1.25)
  assert.equal(getSteppedPreviewImageZoom(1, -0.25), 1)
  assert.equal(getSteppedPreviewImageZoom(4, 0.25), 4)
  assert.equal(getToggledPreviewImageZoom(1), 2)
  assert.equal(getToggledPreviewImageZoom(2.5), 1)
})
