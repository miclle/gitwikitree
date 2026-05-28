import type { PreviewType } from '../shared/types'

export const textPreviewProbeBytes = 32 * 1024

export function detectPreviewType(extension: string, sample?: Buffer): PreviewType {
  if (['.md', '.markdown'].includes(extension)) return 'markdown'
  if (['.html', '.htm'].includes(extension)) return 'html'
  if (extension === '.svg') return 'svg'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico'].includes(extension)) return 'image'
  if (
    [
      '.txt',
      '.json',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.yml',
      '.yaml',
      '.xml',
      '.toml',
      '.ini',
      '.env',
      '.gitignore',
      '.dockerignore',
      '.sh',
      '.zsh',
      '.bash',
      '.py',
      '.rb',
      '.go',
      '.rs',
      '.swift',
      '.java',
      '.c',
      '.h',
      '.cpp',
      '.hpp',
      '.m',
      '.mm',
      '.sql',
      '.csv',
      '.log',
      ''
    ].includes(extension)
  ) {
    return 'text'
  }

  if (sample && looksLikeText(sample)) return 'text'

  return 'unsupported'
}

function looksLikeText(sample: Buffer): boolean {
  if (sample.length === 0) return true
  if (sample.includes(0)) return false

  const decoded = sample.toString('utf8')
  const replacementCharacters = countMatches(decoded, '\ufffd')
  if (replacementCharacters / decoded.length > 0.01) return false

  let controlCharacters = 0

  for (const character of decoded) {
    const codePoint = character.codePointAt(0) ?? 0
    const isAllowedWhitespace = codePoint === 9 || codePoint === 10 || codePoint === 13
    const isControlCharacter = codePoint < 32 || codePoint === 127

    if (isControlCharacter && !isAllowedWhitespace) {
      controlCharacters += 1
    }
  }

  return controlCharacters / decoded.length <= 0.02
}

function countMatches(value: string, match: string): number {
  let count = 0

  for (const character of value) {
    if (character === match) count += 1
  }

  return count
}
