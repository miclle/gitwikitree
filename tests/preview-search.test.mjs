/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadPreviewSearch() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/preview-search.ts')
  return module
}

test('countSearchMatches counts case-insensitive non-overlapping matches', async () => {
  const { countSearchMatches } = await loadPreviewSearch()

  assert.equal(countSearchMatches('Alpha beta alpha ALPHA', 'alpha'), 3)
  assert.equal(countSearchMatches('aaaa', 'aa'), 2)
})

test('findSearchMatchRanges finds ranges across one flattened text buffer', async () => {
  const { findSearchMatchRanges } = await loadPreviewSearch()

  assert.deepEqual(findSearchMatchRanges('const ok = true', 'const ok'), [{ start: 0, end: 8 }])
  assert.deepEqual(findSearchMatchRanges('Alpha beta alpha', 'alpha'), [
    { start: 0, end: 5 },
    { start: 11, end: 16 }
  ])
})

test('getSteppedSearchIndex wraps through matches in both directions', async () => {
  const { getSteppedSearchIndex } = await loadPreviewSearch()

  assert.equal(getSteppedSearchIndex({ currentIndex: -1, matchCount: 3, direction: 1 }), 0)
  assert.equal(getSteppedSearchIndex({ currentIndex: 2, matchCount: 3, direction: 1 }), 0)
  assert.equal(getSteppedSearchIndex({ currentIndex: 0, matchCount: 3, direction: -1 }), 2)
  assert.equal(getSteppedSearchIndex({ currentIndex: 0, matchCount: 0, direction: 1 }), -1)
})

test('getSelectedPreviewSearchText returns trimmed text selected inside the preview root', async () => {
  const { getSelectedPreviewSearchText } = await loadPreviewSearch()
  const selectedNode = {}
  const previewRoot = {
    contains(node) {
      return node === selectedNode
    }
  }
  const selection = {
    rangeCount: 1,
    toString() {
      return '  selected text  '
    },
    getRangeAt() {
      return { commonAncestorContainer: selectedNode }
    }
  }

  assert.equal(getSelectedPreviewSearchText(selection, previewRoot), 'selected text')
})

test('getSelectedPreviewSearchText ignores text selected outside the preview root', async () => {
  const { getSelectedPreviewSearchText } = await loadPreviewSearch()
  const previewRoot = {
    contains() {
      return false
    }
  }
  const selection = {
    rangeCount: 1,
    toString() {
      return 'outside text'
    },
    getRangeAt() {
      return { commonAncestorContainer: {} }
    }
  }

  assert.equal(getSelectedPreviewSearchText(selection, previewRoot), undefined)
})
