/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadSingleTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadWindowShortcuts() {
  const { module } = await loadSingleTranspiledModule('src/main/window-shortcuts.ts')
  return module
}

test('shouldOpenGlobalSearchFromInput catches CommandOrControl Shift F key presses', async () => {
  const { shouldOpenGlobalSearchFromInput } = await loadWindowShortcuts()

  assert.equal(
    shouldOpenGlobalSearchFromInput({
      type: 'keyDown',
      key: 'F',
      meta: true,
      control: false,
      shift: true
    }),
    true
  )
  assert.equal(
    shouldOpenGlobalSearchFromInput({
      type: 'keyDown',
      key: 'f',
      meta: false,
      control: true,
      shift: true
    }),
    true
  )
})

test('shouldOpenGlobalSearchFromInput ignores plain find and key releases', async () => {
  const { shouldOpenGlobalSearchFromInput } = await loadWindowShortcuts()

  assert.equal(
    shouldOpenGlobalSearchFromInput({
      type: 'keyDown',
      key: 'f',
      meta: true,
      control: false,
      shift: false
    }),
    false
  )
  assert.equal(
    shouldOpenGlobalSearchFromInput({
      type: 'keyUp',
      key: 'f',
      meta: true,
      control: false,
      shift: true
    }),
    false
  )
})

test('shouldOpenCurrentTabSearchFromInput catches plain CommandOrControl F only', async () => {
  const { shouldOpenCurrentTabSearchFromInput } = await loadWindowShortcuts()

  assert.equal(
    shouldOpenCurrentTabSearchFromInput({
      type: 'keyDown',
      key: 'f',
      meta: true,
      control: false,
      shift: false
    }),
    true
  )
  assert.equal(
    shouldOpenCurrentTabSearchFromInput({
      type: 'keyDown',
      key: 'f',
      meta: true,
      control: false,
      shift: true
    }),
    false
  )
})

test('getFileTabShortcutPositionFromInput catches CommandOrControl number shortcuts', async () => {
  const { getFileTabShortcutPositionFromInput } = await loadWindowShortcuts()

  assert.equal(
    getFileTabShortcutPositionFromInput({
      type: 'keyDown',
      key: '1',
      meta: true,
      control: false,
      shift: false
    }),
    1
  )
  assert.equal(
    getFileTabShortcutPositionFromInput({
      type: 'keyDown',
      key: '9',
      meta: false,
      control: true,
      shift: false
    }),
    9
  )
})

test('getFileTabShortcutPositionFromInput ignores shifted numbers and key releases', async () => {
  const { getFileTabShortcutPositionFromInput } = await loadWindowShortcuts()

  assert.equal(
    getFileTabShortcutPositionFromInput({
      type: 'keyDown',
      key: '1',
      meta: true,
      control: false,
      shift: true
    }),
    undefined
  )
  assert.equal(
    getFileTabShortcutPositionFromInput({
      type: 'keyUp',
      key: '1',
      meta: true,
      control: false,
      shift: false
    }),
    undefined
  )
  assert.equal(
    getFileTabShortcutPositionFromInput({
      type: 'keyDown',
      key: '0',
      meta: true,
      control: false,
      shift: false
    }),
    undefined
  )
})
