export type MarkdownPreview = {
  title?: string
  content: string
}

function unquoteYamlValue(value: string): string {
  const trimmed = value.trim()
  const quote = trimmed[0]

  if ((quote === '"' || quote === "'") && trimmed.at(-1) === quote) {
    return trimmed.slice(1, -1).trim()
  }

  return trimmed
}

function firstMarkdownHeading(markdown: string): string | undefined {
  const firstContentLine = markdown
    .split('\n')
    .find((line) => line.trim().length > 0)
    ?.trim()
  const heading = firstContentLine?.match(/^#{1,6}\s+(.+)$/)

  return heading?.[1].trim()
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" data-markdown-link="true">$1</a>')
}

function plainInlineMarkdown(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[_*~]/g, '')
    .trim()
}

export function markdownHeadingId(value: string): string {
  const slug = plainInlineMarkdown(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

  return slug || 'section'
}

function splitTableRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let escaped = false

  for (const character of trimmed) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === '\\') {
      escaped = true
      continue
    }

    if (character === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  cells.push(current.trim())
  return cells
}

function getTableAlignments(
  row: string
): Array<'left' | 'center' | 'right' | undefined> | undefined {
  const cells = splitTableRow(row)

  if (cells.length === 0 || !cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))) {
    return undefined
  }

  return cells.map((cell) => {
    const compact = cell.replace(/\s+/g, '')
    if (compact.startsWith(':') && compact.endsWith(':')) return 'center'
    if (compact.endsWith(':')) return 'right'
    if (compact.startsWith(':')) return 'left'
    return undefined
  })
}

function isTableStart(currentLine: string, nextLine?: string): boolean {
  return Boolean(
    currentLine.includes('|') && nextLine?.includes('|') && getTableAlignments(nextLine)
  )
}

function renderTableCell(
  tag: 'td' | 'th',
  content: string,
  alignment: 'left' | 'center' | 'right' | undefined
): string {
  const alignAttribute = alignment ? ` style="text-align: ${alignment}"` : ''
  return `<${tag}${alignAttribute}>${renderInlineMarkdown(content)}</${tag}>`
}

function decodeLinkPath(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

function normalizeRepositoryPath(path: string): string | undefined {
  const segments: string[] = []

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue

    if (segment === '..') {
      if (segments.length === 0) return undefined
      segments.pop()
      continue
    }

    segments.push(segment)
  }

  return segments.join('/')
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  const headingIds = new Map<string, number>()
  let inCode = false
  let inList = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (line.startsWith('```')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      continue
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`)
      continue
    }

    if (isTableStart(line, lines[index + 1])) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }

      const headers = splitTableRow(line)
      const alignments = getTableAlignments(lines[index + 1]) ?? []
      const bodyRows: string[] = []
      index += 2

      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const cells = splitTableRow(lines[index])
        bodyRows.push(
          `<tr>${headers
            .map((_, cellIndex) =>
              renderTableCell('td', cells[cellIndex] ?? '', alignments[cellIndex])
            )
            .join('')}</tr>`
        )
        index += 1
      }

      index -= 1
      html.push(
        `<table><thead><tr>${headers
          .map((header, cellIndex) => renderTableCell('th', header, alignments[cellIndex]))
          .join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>`
      )
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      const baseId = markdownHeadingId(heading[2])
      const idCount = headingIds.get(baseId) ?? 0
      headingIds.set(baseId, idCount + 1)
      const id = idCount === 0 ? baseId : `${baseId}-${idCount}`
      html.push(`<h${level} id="${escapeHtml(id)}">${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const listItem = line.match(/^\s*[-*]\s+(.*)$/)
    if (listItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`)
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    html.push(line.trim() ? `<p>${renderInlineMarkdown(line)}</p>` : '')
  }

  if (inList) html.push('</ul>')
  if (inCode) html.push('</code></pre>')
  return html.join('\n')
}

export function isExternalLink(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')
}

export function resolveMarkdownLinkPath(href: string, sourcePath: string): string | undefined {
  const trimmedHref = href.trim()
  if (!trimmedHref || trimmedHref.startsWith('#') || isExternalLink(trimmedHref)) return undefined

  const pathOnly = trimmedHref.split(/[?#]/, 1)[0]
  const decodedPath = decodeLinkPath(pathOnly)

  if (decodedPath.startsWith('/')) {
    return normalizeRepositoryPath(decodedPath.slice(1))
  }

  const sourceDirectory = sourcePath.split('/').filter(Boolean).slice(0, -1).join('/')
  return normalizeRepositoryPath([sourceDirectory, decodedPath].filter(Boolean).join('/'))
}

export function getMarkdownPreview(markdown: string): MarkdownPreview {
  const normalized = markdown.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return { content: markdown }
  }

  const endIndex = normalized.indexOf('\n---', 4)
  if (endIndex === -1) {
    return { content: markdown }
  }

  const frontMatter = normalized.slice(4, endIndex)
  const titleLine = frontMatter
    .split('\n')
    .find((line) => line.trimStart().toLowerCase().startsWith('title:'))
  const title = titleLine ? unquoteYamlValue(titleLine.split(':').slice(1).join(':')) : undefined
  const contentStart = normalized.indexOf('\n', endIndex + 1)
  const content = contentStart === -1 ? '' : normalized.slice(contentStart + 1).trimStart()
  const displayTitle = title && firstMarkdownHeading(content) !== title ? title : undefined

  return {
    content,
    title: displayTitle
  }
}
