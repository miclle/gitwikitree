/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadI18n() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/i18n.ts',
    prefix: 'gitwikitree-i18n-test-',
    modules: ['src/renderer/src/i18n.ts', 'src/shared/types.ts']
  })

  return { module, tempDir }
}

test('createTranslator resolves English and Chinese UI labels', async () => {
  const { module, tempDir } = await loadI18n()

  try {
    assert.equal(module.createTranslator('en')('settings.language'), 'Language')
    assert.equal(module.createTranslator('zh-CN')('settings.language'), '语言')
    assert.equal(module.createTranslator('zh-CN')('branch.current'), '当前')
    assert.equal(module.createTranslator('en')('fileView.blame'), 'Blame')
    assert.equal(module.createTranslator('zh-CN')('fileView.blame'), 'Blame')
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('each supported language provides the same translation keys', async () => {
  const { module, tempDir } = await loadI18n()

  try {
    const keys = Object.keys(module.messages.en).sort()

    for (const language of module.supportedLanguages) {
      assert.deepEqual(Object.keys(module.messages[language]).sort(), keys)
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
