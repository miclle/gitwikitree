/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadMouseEvents() {
  const { module } = await loadSingleTranspiledModule('src/renderer/src/mouse-events.ts')
  return module
}

test('shouldHandleNavigationClick accepts primary and middle clicks only', async () => {
  const { shouldHandleNavigationClick } = await loadMouseEvents()

  assert.equal(shouldHandleNavigationClick({ type: 'click', button: 0 }), true)
  assert.equal(shouldHandleNavigationClick({ type: 'auxclick', button: 1 }), true)
  assert.equal(shouldHandleNavigationClick({ type: 'auxclick', button: 2 }), false)
})

test('isPrimaryClick ignores auxiliary clicks', async () => {
  const { isPrimaryClick } = await loadMouseEvents()

  assert.equal(isPrimaryClick({ type: 'click', button: 0 }), true)
  assert.equal(isPrimaryClick({ type: 'auxclick', button: 1 }), false)
  assert.equal(isPrimaryClick({ type: 'auxclick', button: 2 }), false)
})
