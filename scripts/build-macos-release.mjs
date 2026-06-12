/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execFileSync } from 'node:child_process'

const supportedTargets = {
  arm64: { builderArch: '--arm64', channel: 'latest-arm64' },
  x64: { builderArch: '--x64', channel: 'latest-x64' }
}

const target = supportedTargets[process.arch]

if (!target) {
  throw new Error(`Unsupported macOS release arch: ${process.arch}. Expected arm64 or x64.`)
}

run('npm', ['run', 'build'])
run('npx', [
  'electron-builder',
  '--mac',
  target.builderArch,
  '-c.mac.notarize=true',
  `-c.publish.channel=${target.channel}`
])

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}
