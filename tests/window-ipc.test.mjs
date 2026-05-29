/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadWindowIpc() {
  const { module } = await loadTranspiledModule({
    entry: 'src/main/window-ipc.ts',
    modules: ['src/main/window-ipc.ts']
  })
  return module
}

function createHarness(browserWindow = createBrowserWindow()) {
  const handlers = new Map()
  const createdWindows = []

  return {
    handlers,
    browserWindow,
    createdWindows,
    dependencies: {
      ipcMain: {
        handle: (channel, handler) => {
          handlers.set(channel, handler)
        }
      },
      createWindow: () => {
        createdWindows.push('created')
      },
      getWindowFromWebContents: () => browserWindow
    }
  }
}

function createBrowserWindow(maximized = false) {
  const calls = []

  return {
    calls,
    close: () => calls.push('close'),
    minimize: () => calls.push('minimize'),
    isMaximized: () => maximized,
    maximize: () => calls.push('maximize'),
    unmaximize: () => calls.push('unmaximize')
  }
}

test('registerWindowIpcHandlers registers window channels', async () => {
  const { registerWindowIpcHandlers } = await loadWindowIpc()
  const { handlers, dependencies } = createHarness()

  registerWindowIpcHandlers(dependencies)

  assert.deepEqual([...handlers.keys()], ['window:new', 'window:control'])
})

test('window:new creates a new window', async () => {
  const { registerWindowIpcHandlers } = await loadWindowIpc()
  const { handlers, createdWindows, dependencies } = createHarness()

  registerWindowIpcHandlers(dependencies)
  handlers.get('window:new')()

  assert.deepEqual(createdWindows, ['created'])
})

test('window:control dispatches close, minimize, and maximize actions', async () => {
  const { registerWindowIpcHandlers } = await loadWindowIpc()
  const { handlers, browserWindow, dependencies } = createHarness()

  registerWindowIpcHandlers(dependencies)
  handlers.get('window:control')({ sender: {} }, 'close')
  handlers.get('window:control')({ sender: {} }, 'minimize')
  handlers.get('window:control')({ sender: {} }, 'toggle-maximize')

  assert.deepEqual(browserWindow.calls, ['close', 'minimize', 'maximize'])
})

test('window:control unmaximizes an already maximized window', async () => {
  const { registerWindowIpcHandlers } = await loadWindowIpc()
  const browserWindow = createBrowserWindow(true)
  const { handlers, dependencies } = createHarness(browserWindow)

  registerWindowIpcHandlers(dependencies)
  handlers.get('window:control')({ sender: {} }, 'toggle-maximize')

  assert.deepEqual(browserWindow.calls, ['unmaximize'])
})
