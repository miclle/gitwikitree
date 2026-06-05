import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

const appName = 'Git Wikitree'
const appId = 'com.miclle.gitwikitree.dev'
const iconFile = 'gitwikitree-dev.icns'
const projectRoot = process.cwd()
const iconSource = join(projectRoot, 'build', 'icon.icns')
const electronDist = join(projectRoot, 'node_modules', 'electron', 'dist')
const electronPackage = join(projectRoot, 'node_modules', 'electron')
const electronInstallScript = join(electronPackage, 'install.js')
const defaultElectronApp = join(electronDist, 'Electron.app')
const electronApp = join(electronDist, `${appName}.app`)
const entitlementsPath = join(projectRoot, 'build', 'entitlements.mac.plist')
const plistPath = join(electronApp, 'Contents', 'Info.plist')
const resourcesDir = join(electronApp, 'Contents', 'Resources')
const executablePath = `${appName}.app/Contents/MacOS/Electron`

if (process.platform !== 'darwin') {
  process.exit(0)
}

ensureElectronInstalled()

if (existsSync(defaultElectronApp)) {
  rmSync(electronApp, { force: true, recursive: true })
  renameSync(defaultElectronApp, electronApp)
}

if (!existsSync(plistPath)) {
  process.exit(0)
}

if (!existsSync(iconSource)) {
  throw new Error(`Missing app icon: ${iconSource}`)
}

copyFileSync(iconSource, join(resourcesDir, iconFile))

for (const entry of readdirSync(resourcesDir)) {
  if (/gitdock/i.test(entry)) {
    rmSync(join(resourcesDir, entry), { force: true, recursive: true })
  }
}

setPlistValue('CFBundleDisplayName', appName)
setPlistValue('CFBundleName', appName)
setPlistValue('CFBundleIdentifier', appId)
setPlistValue('CFBundleIconFile', iconFile)
writeFileSync(join(electronPackage, 'path.txt'), executablePath)
execFileSync('/usr/bin/touch', [electronApp], { stdio: 'ignore' })
signDevelopmentApp()

console.log(`Prepared ${appName}.app for ${appName} development icon`)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setPlistValue(key, value) {
  const plistBuddy = '/usr/libexec/PlistBuddy'

  try {
    execFileSync(plistBuddy, ['-c', `Set :${key} ${value}`, plistPath], { stdio: 'ignore' })
  } catch {
    execFileSync(plistBuddy, ['-c', `Add :${key} string ${value}`, plistPath], { stdio: 'ignore' })
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function ensureElectronInstalled() {
  const pathFile = join(electronPackage, 'path.txt')
  const currentExecutable = existsSync(pathFile) ? readFileSync(pathFile, 'utf8') : ''

  if (currentExecutable && existsSync(join(electronDist, currentExecutable))) {
    return
  }

  if (!existsSync(electronInstallScript)) {
    throw new Error(`Missing Electron install script: ${electronInstallScript}`)
  }

  console.log('Electron binary is missing; installing Electron for development...')
  execFileSync(process.execPath, [electronInstallScript], { stdio: 'inherit' })

  const installedExecutable = existsSync(pathFile) ? readFileSync(pathFile, 'utf8') : ''

  if (!installedExecutable || !existsSync(join(electronDist, installedExecutable))) {
    throw new Error(
      'Electron failed to install correctly. Try deleting node_modules/electron and running npm install again.'
    )
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function signDevelopmentApp() {
  if (!existsSync(entitlementsPath)) {
    throw new Error(`Missing macOS entitlements: ${entitlementsPath}`)
  }

  execFileSync(
    '/usr/bin/codesign',
    ['--force', '--deep', '--sign', '-', '--entitlements', entitlementsPath, electronApp],
    { stdio: 'ignore' }
  )
}
