import type {
  AppLanguage,
  GitLastChange,
  PreviewPayload,
  RepositoryPayload
} from '../../shared/types'

export type EditorStatusBarState = {
  line: number
  column: number
  selectionCount: number
  selectedCharacters: number
  characterCount: number
  indentStyle: 'space' | 'tab'
  indentSize: number
  encoding: string
  modifiedAt: string
  lastChange?: GitLastChange
}

function createDateTimeFormatter(language: AppLanguage): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(language === 'zh-CN' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: language === 'zh-CN' ? 'numeric' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

function unit(count: number, singular: string, plural: string, language: AppLanguage): string {
  if (language === 'zh-CN') return `${count} ${singular}`

  return `${count} ${count === 1 ? singular : plural}`
}

const statusLabels = {
  en: {
    item: 'item',
    items: 'items',
    word: 'word',
    words: 'words',
    line: 'line',
    lines: 'lines',
    page: 'page',
    pages: 'pages',
    selection: 'selection',
    selections: 'selections',
    char: 'char',
    chars: 'chars',
    tabSize: 'Tab Size',
    spaces: 'Spaces',
    modified: 'Modified',
    workingTree: 'Working tree',
    worktree: 'Worktree'
  },
  'zh-CN': {
    item: '项',
    items: '项',
    word: '个词',
    words: '个词',
    line: '行',
    lines: '行',
    page: '页',
    pages: '页',
    selection: '处选择',
    selections: '处选择',
    char: '个字符',
    chars: '个字符',
    tabSize: '制表符宽度',
    spaces: '空格',
    modified: '修改于',
    workingTree: '工作树',
    worktree: 'Worktree'
  }
} satisfies Record<AppLanguage, Record<string, string>>

const englishDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export function getStatusBarPath(repository: RepositoryPayload, preview: PreviewPayload): string {
  const previewPath =
    preview.kind === 'directory' && preview.readme ? preview.readme.path : preview.path

  return previewPath ? `${repository.path}/${previewPath}` : repository.path
}

export function getStatusBarWorkspaceLabel(repository: RepositoryPayload): string {
  return repository.source === 'worktree' ? 'Worktree' : 'Working tree'
}

export function getLocalizedStatusBarWorkspaceLabel(
  repository: RepositoryPayload,
  language: AppLanguage
): string {
  const labels = statusLabels[language]
  return repository.source === 'worktree' ? labels.worktree : labels.workingTree
}

type StatusBarFileFactsOptions = {
  pdfPageCount?: number
  language?: AppLanguage
}

export function getStatusBarFileFacts(
  preview: PreviewPayload,
  options: StatusBarFileFactsOptions = {}
): string[] {
  const language = options.language ?? 'en'
  const labels = statusLabels[language]
  const facts: string[] = []

  if (preview.kind === 'directory') {
    const itemCount = preview.entries?.length
    if (typeof itemCount === 'number')
      facts.push(unit(itemCount, labels.item, labels.items, language))
  } else {
    if (preview.content !== undefined) {
      const wordCount = countWords(preview.content)
      const lineCount = countLines(preview.content)
      facts.push(unit(wordCount, labels.word, labels.words, language))
      facts.push(unit(lineCount, labels.line, labels.lines, language))
    }

    if (preview.previewType === 'pdf' && options.pdfPageCount !== undefined) {
      facts.push(unit(options.pdfPageCount, labels.page, labels.pages, language))
    }

    facts.push(formatFileSize(preview.size))
    if (preview.encoding) facts.push(preview.encoding)
  }

  facts.push(formatChangeTime(preview.modifiedAt, preview.lastChange, language))
  return facts
}

export function getStatusBarEditorFacts(
  status: EditorStatusBarState,
  language: AppLanguage = 'en'
): string[] {
  const labels = statusLabels[language]
  const facts = [`Ln ${status.line}, Col ${status.column}`]

  if (status.selectionCount > 0) {
    facts.push(
      `${unit(status.selectionCount, labels.selection, labels.selections, language)} (${unit(status.selectedCharacters, labels.char, labels.chars, language)})`
    )
  }

  facts.push(unit(status.characterCount, labels.char, labels.chars, language))
  facts.push(
    status.indentStyle === 'tab'
      ? `${labels.tabSize}: ${status.indentSize}`
      : `${labels.spaces}: ${status.indentSize}`
  )
  facts.push(status.encoding)
  facts.push(formatChangeTime(status.modifiedAt, status.lastChange, language))

  return facts
}

function formatChangeTime(
  modifiedAt: string,
  lastChange: GitLastChange | undefined,
  language: AppLanguage
): string {
  const labels = statusLabels[language]
  return lastChange
    ? formatLastChange(lastChange, language)
    : `${labels.modified} ${formatModifiedAt(modifiedAt, language)}`
}

function formatLastChange(lastChange: GitLastChange, language: AppLanguage): string {
  return `${lastChange.authorName}, ${formatModifiedAt(lastChange.committedAt, language)}`
}

function countWords(content: string): number {
  return content.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0
}

function countLines(content: string): number {
  if (!content) return 0

  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`

  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function formatModifiedAt(value: string, language: AppLanguage): string {
  if (language === 'en') return englishDateTimeFormatter.format(new Date(value))

  const parts = Object.fromEntries(
    createDateTimeFormatter(language)
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value])
  )

  return `${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}:${parts.minute}`
}
