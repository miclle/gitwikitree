import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('macOS current-arch release script uses architecture-specific update channels', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8')
  )
  const releaseScript = await readFile(
    new URL('../scripts/build-macos-release.mjs', import.meta.url),
    'utf8'
  )

  assert.equal(packageJson.scripts['build:mac:release'], 'node scripts/build-macos-release.mjs')
  assert.match(releaseScript, /arm64['"], channel: ['"]latest-arm64/)
  assert.match(releaseScript, /x64['"], channel: ['"]latest-x64/)
  assert.match(releaseScript, /-c\.publish\.channel=\$\{target\.channel\}/)
})
