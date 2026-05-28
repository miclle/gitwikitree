import hljs from 'highlight.js/lib/common'

const extensionLanguages: Record<string, string> = {
  '.bash': 'bash',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.css': 'css',
  '.diff': 'diff',
  '.go': 'go',
  '.h': 'c',
  '.hpp': 'cpp',
  '.html': 'xml',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsx': 'javascript',
  '.less': 'less',
  '.lua': 'lua',
  '.m': 'objectivec',
  '.mm': 'objectivec',
  '.php': 'php',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.sass': 'scss',
  '.scss': 'scss',
  '.sh': 'bash',
  '.sql': 'sql',
  '.swift': 'swift',
  '.toml': 'ini',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.zsh': 'bash'
}

export function languageForExtension(extension: string): string | undefined {
  return extensionLanguages[extension.toLowerCase()]
}

function escapeCode(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function highlightCodeBlock(code: string, language?: string): string {
  if (!language || !hljs.getLanguage(language)) {
    return escapeCode(code)
  }

  return hljs.highlight(code, { language, ignoreIllegals: true }).value
}
