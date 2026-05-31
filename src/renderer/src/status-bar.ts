import type { GitLastChange, PreviewPayload, RepositoryPayload } from '../../shared/types'

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

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
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

type StatusBarFileFactsOptions = {
  pdfPageCount?: number
}

export function getStatusBarFileFacts(
  preview: PreviewPayload,
  options: StatusBarFileFactsOptions = {}
): string[] {
  const facts: string[] = []

  if (preview.kind === 'directory') {
    const itemCount = preview.entries?.length
    if (typeof itemCount === 'number')
      facts.push(`${itemCount} ${itemCount === 1 ? 'item' : 'items'}`)
  } else {
    if (preview.content !== undefined) {
      const wordCount = countWords(preview.content)
      const lineCount = countLines(preview.content)
      facts.push(`${wordCount} ${wordCount === 1 ? 'word' : 'words'}`)
      facts.push(`${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`)
    }

    if (preview.previewType === 'pdf' && options.pdfPageCount !== undefined) {
      facts.push(`${options.pdfPageCount} ${options.pdfPageCount === 1 ? 'page' : 'pages'}`)
    }

    facts.push(formatFileSize(preview.size))
    if (preview.encoding) facts.push(preview.encoding)
  }

  facts.push(formatChangeTime(preview.modifiedAt, preview.lastChange))
  return facts
}

export function getStatusBarEditorFacts(status: EditorStatusBarState): string[] {
  const facts = [`Ln ${status.line}, Col ${status.column}`]

  if (status.selectionCount > 0) {
    facts.push(
      `${status.selectionCount} ${status.selectionCount === 1 ? 'selection' : 'selections'} (${status.selectedCharacters} ${status.selectedCharacters === 1 ? 'char' : 'chars'})`
    )
  }

  facts.push(`${status.characterCount} ${status.characterCount === 1 ? 'char' : 'chars'}`)
  facts.push(
    status.indentStyle === 'tab' ? `Tab Size: ${status.indentSize}` : `Spaces: ${status.indentSize}`
  )
  facts.push(status.encoding)
  facts.push(formatChangeTime(status.modifiedAt, status.lastChange))

  return facts
}

function formatChangeTime(modifiedAt: string, lastChange?: GitLastChange): string {
  return lastChange ? formatLastChange(lastChange) : `Modified ${formatModifiedAt(modifiedAt)}`
}

function formatLastChange(lastChange: GitLastChange): string {
  return `${lastChange.authorName}, ${formatModifiedAt(lastChange.committedAt)}`
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

function formatModifiedAt(value: string): string {
  return dateTimeFormatter.format(new Date(value))
}
