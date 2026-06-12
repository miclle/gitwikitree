/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadAutoUpdate() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/auto-update.ts',
    modules: ['src/main/auto-update.ts']
  })
  return module
}

function createUpdater() {
  const listeners = new Map()
  const calls = []

  return {
    calls,
    updater: {
      autoDownload: false,
      on(eventName, listener) {
        listeners.set(eventName, listener)
      },
      checkForUpdates() {
        calls.push('checkForUpdates')
        return Promise.resolve()
      },
      quitAndInstall() {
        calls.push('quitAndInstall')
      }
    },
    emit(eventName, ...args) {
      const listener = listeners.get(eventName)
      assert.equal(typeof listener, 'function')
      return listener(...args)
    }
  }
}

test('configureAutoUpdates skips update checks for unpackaged apps', async () => {
  const { configureAutoUpdates } = await loadAutoUpdate()
  const { calls, updater } = createUpdater()

  configureAutoUpdates({
    app: { isPackaged: false },
    autoUpdater: updater,
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    getFocusedWindow: () => null
  })

  assert.deepEqual(calls, [])
  assert.equal(updater.autoDownload, false)
})

test('configureAutoUpdates checks for updates and logs failures for packaged apps', async () => {
  const { configureAutoUpdates } = await loadAutoUpdate()
  const calls = []
  const messages = []
  const updater = {
    autoDownload: false,
    channel: null,
    on() {
      calls.push('on')
    },
    async checkForUpdates() {
      throw new Error('network unavailable')
    },
    quitAndInstall() {
      calls.push('quitAndInstall')
    }
  }

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater: updater,
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    getFocusedWindow: () => null,
    channel: 'latest-arm64',
    logger: { warn: (message, error) => messages.push([message, error.message]) }
  })

  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(updater.autoDownload, true)
  assert.equal(updater.channel, 'latest-arm64')
  assert.deepEqual(calls, ['on'])
  assert.deepEqual(messages, [['Failed to check for updates', 'network unavailable']])
})

test('getAutoUpdateChannel uses architecture-specific macOS channels only', async () => {
  const { getAutoUpdateChannel } = await loadAutoUpdate()

  assert.equal(getAutoUpdateChannel('darwin', 'arm64'), 'latest-arm64')
  assert.equal(getAutoUpdateChannel('darwin', 'x64'), 'latest-x64')
  assert.equal(getAutoUpdateChannel('win32', 'x64'), undefined)
  assert.equal(getAutoUpdateChannel('linux', 'x64'), undefined)
})

test('configureAutoUpdates prompts to restart after an update downloads', async () => {
  const { configureAutoUpdates } = await loadAutoUpdate()
  const { calls, updater, emit } = createUpdater()
  const focusedWindow = {}
  const prompts = []

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater: updater,
    dialog: {
      showMessageBox: async (browserWindow, options) => {
        prompts.push({ browserWindow, options })
        return { response: 0 }
      }
    },
    getFocusedWindow: () => focusedWindow
  })

  await emit('update-downloaded')

  assert.deepEqual(calls, ['checkForUpdates', 'quitAndInstall'])
  assert.equal(prompts[0].browserWindow, focusedWindow)
  assert.equal(prompts[0].options.title, 'Update ready')
})

test('configureAutoUpdates localizes downloaded update prompts', async () => {
  const { configureAutoUpdates } = await loadAutoUpdate()
  const { updater, emit } = createUpdater()
  const prompts = []

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater: updater,
    dialog: {
      showMessageBox: async (options) => {
        prompts.push(options)
        return { response: 1 }
      }
    },
    getFocusedWindow: () => null,
    language: 'zh-CN'
  })

  await emit('update-downloaded')

  assert.deepEqual(prompts[0].buttons, ['重启', '稍后'])
  assert.equal(prompts[0].title, '更新已就绪')
  assert.equal(prompts[0].message, '新版本已下载。重启 Git Wikitree 后将完成安装。')
})

test('configureAutoUpdates lets users install downloaded updates later', async () => {
  const { configureAutoUpdates } = await loadAutoUpdate()
  const { calls, updater, emit } = createUpdater()

  configureAutoUpdates({
    app: { isPackaged: true },
    autoUpdater: updater,
    dialog: { showMessageBox: async () => ({ response: 1 }) },
    getFocusedWindow: () => null
  })

  await emit('update-downloaded')

  assert.deepEqual(calls, ['checkForUpdates'])
})
