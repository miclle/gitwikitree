/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

const appName = 'Git Wikitree.app'
const projectRoot = process.cwd()
const args = process.argv.slice(2)

if (process.platform !== 'darwin') {
  throw new Error('macOS release verification must run on macOS')
}

const options = parseArgs(args)
const appPath = options.app ? resolve(projectRoot, options.app) : findLatestApp()
const dmgPath = options.dmg ? resolve(projectRoot, options.dmg) : findLatestDmg()

verifyApp(appPath, 'built app')
verifyDmg(dmgPath)

console.log('macOS release verification passed')

function parseArgs(values) {
  const parsed = {}

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]

    if (value === '--app') {
      parsed.app = readOptionValue(values, (index += 1), value)
    } else if (value === '--dmg') {
      parsed.dmg = readOptionValue(values, (index += 1), value)
    } else if (value === '--help') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${value}`)
    }
  }

  return parsed
}

function readOptionValue(values, index, optionName) {
  const optionValue = values[index]

  if (!optionValue || optionValue.startsWith('--')) {
    throw new Error(`Missing value for ${optionName}`)
  }

  return optionValue
}

function findLatestDmg() {
  const distDir = join(projectRoot, 'dist')

  if (!existsSync(distDir)) {
    throw new Error('Missing dist/ directory. Run a macOS release build first.')
  }

  const dmgs = readdirSync(distDir)
    .filter((entry) => entry.endsWith('.dmg'))
    .map((entry) => join(distDir, entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  if (dmgs.length === 0) {
    throw new Error('No DMG found in dist/. Pass --dmg <path> to verify a specific file.')
  }

  return dmgs[0]
}

function findLatestApp() {
  const distDir = join(projectRoot, 'dist')

  if (!existsSync(distDir)) {
    throw new Error('Missing dist/ directory. Run a macOS release build first.')
  }

  const apps = readdirSync(distDir)
    .filter((entry) => entry.startsWith('mac'))
    .map((entry) => join(distDir, entry, appName))
    .filter((entry) => existsSync(entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)

  if (apps.length === 0) {
    throw new Error(
      'No built .app found under dist/mac*/. Pass --app <path> to verify a specific app.'
    )
  }

  return apps[0]
}

function verifyApp(targetPath, label) {
  if (!existsSync(targetPath)) {
    throw new Error(`Missing ${label}: ${targetPath}`)
  }

  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', targetPath])
  run('spctl', ['--assess', '--type', 'execute', '--verbose', targetPath])
  run('xcrun', ['stapler', 'validate', targetPath])
}

function verifyDmg(targetPath) {
  if (!existsSync(targetPath)) {
    throw new Error(`Missing DMG: ${targetPath}`)
  }

  console.log(`Verifying DMG container: ${targetPath}`)
  const mountPoint = attachDmg(targetPath)

  try {
    verifyApp(join(mountPoint, appName), `DMG app in ${basename(targetPath)}`)
  } finally {
    detachDmg(mountPoint)
  }
}

function attachDmg(targetPath) {
  const output = run('hdiutil', ['attach', targetPath, '-nobrowse'], { capture: true })
  const mountLine = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.includes('/Volumes/'))

  if (!mountLine) {
    throw new Error(`Unable to find mounted volume in hdiutil output:\n${output}`)
  }

  return mountLine.slice(mountLine.indexOf('/Volumes/'))
}

function detachDmg(mountPoint) {
  run('hdiutil', ['detach', mountPoint])
}

function run(command, commandArgs, options = {}) {
  const label = `${command} ${commandArgs.map(quoteArg).join(' ')}`
  console.log(`$ ${label}`)

  return execFileSync(command, commandArgs, {
    encoding: 'utf8',
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  })
}

function quoteArg(value) {
  return /\s/.test(value) ? `"${value}"` : value
}

function printHelp() {
  console.log(`Usage: npm run verify:mac:release -- [--app <path>] [--dmg <path>]

Verifies:
- the built .app signature, Gatekeeper assessment, and stapled notarization ticket
- the .app contained inside the DMG after mounting it
`)
}
