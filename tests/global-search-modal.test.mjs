/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readGlobalSearchModal() {
  return readFile(
    new URL('../src/renderer/src/components/GlobalSearchModal.tsx', import.meta.url),
    'utf8'
  )
}

async function readMainCss() {
  return readFile(new URL('../src/renderer/src/assets/main.css', import.meta.url), 'utf8')
}

test('global search modal closes on Escape even when focus leaves the input', async () => {
  const source = await readGlobalSearchModal()

  assert.match(
    source,
    /window\.addEventListener\('keydown', handleWindowKeyDown\)/,
    'modal should listen for Escape at the window level while open'
  )
  assert.match(
    source,
    /window\.removeEventListener\('keydown', handleWindowKeyDown\)/,
    'modal should clean up the window Escape listener'
  )
})

test('global search modal debounces repository searches through a named delay', async () => {
  const source = await readGlobalSearchModal()

  assert.match(
    source,
    /export const GLOBAL_SEARCH_DEBOUNCE_MS = 800/,
    'search debounce delay should be named and exported for regression coverage'
  )
  assert.match(
    source,
    /window\.setTimeout\(\(\) => \{[\s\S]*setIsSearching\(true\)[\s\S]*searchRepository[\s\S]*\}, GLOBAL_SEARCH_DEBOUNCE_MS\)/,
    'repository search calls should be delayed by the debounce constant'
  )
  assert.match(
    source,
    /return \(\) => window\.clearTimeout\(timeout\)/,
    'pending debounced searches should be cancelled when the query changes'
  )
  assert.doesNotMatch(
    source,
    /const handleQueryChange = useCallback\([\s\S]*setIsSearching\(true\)[\s\S]*\}, \[\]\)/,
    'typing should not immediately show searching before the debounce fires'
  )
  assert.match(
    source,
    /inFlightSearchRef\.current[\s\S]*queuedSearchRef\.current/,
    'global content searches should avoid launching concurrent repository searches'
  )
})

test('global search close button is pinned to the modal top right', async () => {
  const css = await readMainCss()

  assert.match(css, /\.global-search-modal \{[\s\S]*position: relative;/)
  assert.match(css, /\.global-search-close \{[\s\S]*position: absolute;/)
  assert.match(css, /\.global-search-close \{[\s\S]*top: 10px;/)
  assert.match(css, /\.global-search-close \{[\s\S]*right: 10px;/)
})
