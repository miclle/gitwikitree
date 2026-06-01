import { promises as fs } from 'fs'
import { dirname } from 'path'
import type { AppSettings } from '../shared/types'
import { defaultAppSettings } from '../shared/types'

const maxHomeFileNames = 12

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizeChoice<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) return fallback

  return Math.min(value, max)
}

function isSafeFileName(value: string): boolean {
  return (
    value.length > 0 &&
    !value.includes('\0') &&
    !value.includes('/') &&
    !value.includes('\\') &&
    value !== '.' &&
    value !== '..'
  )
}

export function normalizeHomeFileNames(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultAppSettings.homeFileNames

  const seen = new Set<string>()
  const names: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    const key = name.toLocaleLowerCase()
    if (!isSafeFileName(name) || seen.has(key)) continue

    seen.add(key)
    names.push(name)
    if (names.length >= maxHomeFileNames) break
  }

  return names.length ? names : defaultAppSettings.homeFileNames
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const record = asRecord(value)

  return {
    appearance: normalizeChoice(record.appearance, ['system', 'light', 'dark'], 'system'),
    language: normalizeChoice(record.language, ['en', 'zh-CN'], defaultAppSettings.language),
    homeFilesEnabled:
      typeof record.homeFilesEnabled === 'boolean'
        ? record.homeFilesEnabled
        : defaultAppSettings.homeFilesEnabled,
    homeFileNames: normalizeHomeFileNames(record.homeFileNames),
    previewFontFamily: normalizeChoice(
      record.previewFontFamily,
      ['system', 'sans', 'serif', 'mono'],
      defaultAppSettings.previewFontFamily
    ),
    previewFontSize: normalizeNumber(
      record.previewFontSize,
      defaultAppSettings.previewFontSize,
      11,
      22
    ),
    editorFontFamily: normalizeChoice(
      record.editorFontFamily,
      ['system', 'sans', 'serif', 'mono'],
      defaultAppSettings.editorFontFamily
    ),
    editorFontSize: normalizeNumber(
      record.editorFontSize,
      defaultAppSettings.editorFontSize,
      11,
      22
    ),
    editorIndentStyle: normalizeChoice(
      record.editorIndentStyle,
      ['tab', 'space'],
      defaultAppSettings.editorIndentStyle
    ),
    editorIndentSize: [2, 4, 8].includes(record.editorIndentSize as number)
      ? (record.editorIndentSize as number)
      : defaultAppSettings.editorIndentSize
  }
}

export function createSettingsStore(settingsPath: string): {
  read: () => Promise<AppSettings>
  write: (settings: Partial<AppSettings>) => Promise<AppSettings>
} {
  async function read(): Promise<AppSettings> {
    try {
      const content = await fs.readFile(settingsPath, 'utf8')
      return normalizeAppSettings(JSON.parse(content))
    } catch {
      return defaultAppSettings
    }
  }

  return {
    read,
    async write(settings: Partial<AppSettings>): Promise<AppSettings> {
      const current = await read()
      const normalized = normalizeAppSettings({ ...current, ...settings })
      await fs.mkdir(dirname(settingsPath), { recursive: true })
      await fs.writeFile(settingsPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
      return normalized
    }
  }
}

export { defaultAppSettings }
