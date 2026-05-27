import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

const rendererServer = {
  host: '127.0.0.1',
  port: 43173,
  strictPort: true
}

function devContentSecurityPolicy(): Plugin {
  return {
    name: 'dev-content-security-policy',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [devContentSecurityPolicy(), react()],
    server: rendererServer,
    preview: rendererServer
  }
})
