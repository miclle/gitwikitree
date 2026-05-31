/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadSettingsIpc() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/settings-ipc.ts',
    modules: ['src/main/settings-ipc.ts', 'src/main/settings-store.ts', 'src/shared/types.ts']
  })
  return module
}

test('registerSettingsIpcHandlers exposes get and save channels', async () => {
  const { registerSettingsIpcHandlers } = await loadSettingsIpc()
  const handlers = new Map()
  const calls = []

  registerSettingsIpcHandlers({
    ipcMain: {
      handle: (channel, handler) => {
        handlers.set(channel, handler)
      }
    },
    readSettings: async () => ({ appearance: 'system' }),
    writeSettings: async (settings) => {
      calls.push(settings)
      return { appearance: 'dark' }
    },
    applySettings: (settings) => calls.push(['applySettings', settings])
  })

  assert.deepEqual([...handlers.keys()], ['settings:get', 'settings:save'])
  assert.deepEqual(await handlers.get('settings:get')(), { appearance: 'system' })
  assert.deepEqual(await handlers.get('settings:save')({}, { appearance: 'dark' }), {
    appearance: 'dark'
  })
  assert.deepEqual(calls, [{ appearance: 'dark' }, ['applySettings', { appearance: 'dark' }]])
})
