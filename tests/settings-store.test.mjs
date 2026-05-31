/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadSettingsStore() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/settings-store.ts',
    modules: ['src/main/settings-store.ts', 'src/shared/types.ts']
  })
  return module
}

test('normalizeAppSettings fills defaults and rejects invalid values', async () => {
  const { defaultAppSettings, normalizeAppSettings } = await loadSettingsStore()

  const settings = normalizeAppSettings({
    appearance: 'dark',
    homeFileNames: ['_index.md', '../escape.md', '', '_index.md', 'README.md'],
    previewFontFamily: 'serif',
    previewFontSize: 26,
    editorFontFamily: 'fantasy',
    editorFontSize: 5,
    editorIndentStyle: 'tab',
    editorIndentSize: 3
  })

  assert.deepEqual(settings, {
    ...defaultAppSettings,
    appearance: 'dark',
    homeFileNames: ['_index.md', 'README.md'],
    previewFontFamily: 'serif',
    previewFontSize: 22,
    editorIndentStyle: 'tab'
  })
})

test('settings store reads defaults and writes normalized settings', async () => {
  const { createSettingsStore, defaultAppSettings } = await loadSettingsStore()
  const tempDir = await mkdtemp(join(tmpdir(), 'gitwikitree-settings-'))
  const settingsPath = join(tempDir, 'settings.json')
  const store = createSettingsStore(settingsPath)

  assert.deepEqual(await store.read(), defaultAppSettings)

  const saved = await store.write({
    appearance: 'light',
    homeFileNames: ['index.md', 'README.md'],
    previewFontSize: 18,
    editorFontSize: 16,
    editorIndentStyle: 'space',
    editorIndentSize: 4
  })

  assert.deepEqual(saved, {
    ...defaultAppSettings,
    appearance: 'light',
    homeFileNames: ['index.md', 'README.md'],
    previewFontSize: 18,
    editorFontSize: 16,
    editorIndentStyle: 'space',
    editorIndentSize: 4
  })
  assert.equal(await readFile(settingsPath, 'utf8'), `${JSON.stringify(saved, null, 2)}\n`)

  const updated = await store.write({ appearance: 'dark' })

  assert.deepEqual(updated, { ...saved, appearance: 'dark' })
})
