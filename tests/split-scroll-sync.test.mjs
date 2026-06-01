/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadSplitScrollSync() {
  const { module } = await loadTranspiledModule({
    entry: 'src/renderer/src/hooks/useSplitScrollSync.ts',
    modules: ['src/renderer/src/hooks/useSplitScrollSync.ts']
  })
  return module
}

test('getActiveScrollAnchor chooses the content node nearest the viewport top', async () => {
  const { getActiveScrollAnchor } = await loadSplitScrollSync()
  const anchors = [
    { line: 1, top: 0, height: 24 },
    { line: 8, top: 220, height: 40 },
    { line: 20, top: 640, height: 120 }
  ]

  assert.deepEqual(getActiveScrollAnchor(anchors, 230), anchors[1])
})

test('getNearestLineAnchor maps source lines to the previous preview block', async () => {
  const { getNearestLineAnchor } = await loadSplitScrollSync()
  const anchors = [
    { line: 3, top: 80, height: 32 },
    { line: 12, top: 360, height: 48 },
    { line: 30, top: 900, height: 80 }
  ]

  assert.deepEqual(getNearestLineAnchor(anchors, 18), anchors[1])
  assert.deepEqual(getNearestLineAnchor(anchors, 1), anchors[0])
})

test('getAnchoredScrollTop preserves the source node viewport offset', async () => {
  const { getAnchoredScrollTop } = await loadSplitScrollSync()

  assert.equal(
    getAnchoredScrollTop({
      sourceAnchor: { line: 12, top: 540, height: 24 },
      targetTop: 900,
      sourceScrollTop: 500,
      maxScrollTop: 1200
    }),
    860
  )
  assert.equal(
    getAnchoredScrollTop({
      sourceAnchor: { line: 12, top: 540, height: 24 },
      targetTop: 900,
      sourceScrollTop: 500,
      maxScrollTop: 800
    }),
    800
  )
})

test('getMappedAnchoredScrollTop interpolates between content anchors', async () => {
  const { getMappedAnchoredScrollTop } = await loadSplitScrollSync()

  assert.equal(
    getMappedAnchoredScrollTop({
      sourceAnchors: [
        { line: 10, top: 100, height: 20 },
        { line: 20, top: 300, height: 20 }
      ],
      targetAnchors: [
        { line: 10, top: 400, height: 80 },
        { line: 20, top: 1000, height: 80 }
      ],
      sourceScrollTop: 188,
      maxScrollTop: 2000,
      viewportBias: 12
    }),
    688
  )
})

test('shouldSyncScrollSource ignores passive scroll events from the other pane', async () => {
  const { shouldSyncScrollSource } = await loadSplitScrollSync()

  assert.equal(shouldSyncScrollSource({ activeSourceId: 'editor', sourceId: 'editor' }), true)
  assert.equal(shouldSyncScrollSource({ activeSourceId: undefined, sourceId: 'preview' }), true)
  assert.equal(shouldSyncScrollSource({ activeSourceId: 'editor', sourceId: 'preview' }), false)
})
