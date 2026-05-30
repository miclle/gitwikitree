import { Marked, Renderer, type Tokens } from 'marked'
import { highlightCodeBlock } from './code-highlight'

export type MarkdownPreview = {
  title?: string
  content: string
}

export type MarkdownRenderOptions = {
  resolveImageSrc?: (href: string) => string | undefined
  resolveImagePath?: (href: string) => string | undefined
  resolveImageAbsolutePath?: (href: string) => string | undefined
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

function renderMarkdownLink(href: string, title: string | null, html: string): string {
  const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
  return `<a href="${escapeHtml(href)}"${titleAttribute} data-markdown-link="true">${html}</a>`
}

function rewriteRawHtmlImageSources(html: string, options: MarkdownRenderOptions): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)([^>]*>)/gi,
    (match, prefix: string, quote: string, href: string, closingQuote: string, suffix: string) => {
      const src = options.resolveImageSrc?.(href)
      if (!src) return match

      const imagePath = options.resolveImagePath?.(href) ?? href
      const absolutePath = options.resolveImageAbsolutePath?.(href)
      const absolutePathAttribute = absolutePath
        ? ` data-preview-image-absolute-src="${escapeHtml(absolutePath)}"`
        : ''

      return `${prefix}${quote}${escapeHtml(src)}${closingQuote} data-preview-image-src="${escapeHtml(imagePath)}"${absolutePathAttribute}${suffix}`
    }
  )
}

function createMarkdownRenderer(options: MarkdownRenderOptions = {}): Renderer {
  const renderer = new Renderer()
  const headingIds = new Map<string, number>()

  renderer.heading = function ({ tokens, text, depth }: Tokens.Heading): string {
    const baseId = markdownHeadingId(text)
    const idCount = headingIds.get(baseId) ?? 0
    headingIds.set(baseId, idCount + 1)
    const id = idCount === 0 ? baseId : `${baseId}-${idCount}`
    return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
  }

  renderer.link = function ({ href, title, tokens }: Tokens.Link): string {
    return renderMarkdownLink(href, title ?? null, this.parser.parseInline(tokens))
  }

  renderer.html = function ({ text }: Tokens.HTML): string {
    return options.resolveImageSrc ? rewriteRawHtmlImageSources(text, options) : text
  }

  renderer.image = function ({ href, title, text, tokens }: Tokens.Image): string {
    const alt = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text
    const src = options.resolveImageSrc?.(href) ?? href
    const imagePath = options.resolveImagePath?.(href) ?? href
    const absolutePath = options.resolveImageAbsolutePath?.(href)
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''
    const absolutePathAttribute = absolutePath
      ? ` data-preview-image-absolute-src="${escapeHtml(absolutePath)}"`
      : ''

    return `<img src="${escapeHtml(src)}" data-preview-image-src="${escapeHtml(imagePath)}"${absolutePathAttribute} alt="${escapeHtml(alt)}"${titleAttribute}>`
  }

  renderer.code = function ({ text, lang }: Tokens.Code): string {
    const language = lang?.match(/^\S+/)?.[0]

    if (language?.toLowerCase() === 'mermaid') {
      return `<div class="mermaid-preview" data-mermaid-source="true">${escapeHtml(normalizeMermaidSource(text))}</div>\n`
    }

    return `<div class="markdown-code-block"><button type="button" class="markdown-code-copy" data-copy-code="true" aria-label="Copy code" title="Copy code">Copy</button><pre><code class="hljs${language ? ` language-${escapeHtml(language)}` : ''}">${highlightCodeBlock(
      text,
      language
    )}</code></pre></div>\n`
  }

  return renderer
}

function normalizeMermaidSource(source: string): string {
  const trimmedStart = source.trimStart()

  if (!trimmedStart.startsWith('stateDiagram')) return source

  return normalizeMermaidStateDiagramSource(source)
}

function normalizeMermaidStateDiagramSource(source: string): string {
  const stateLabels = new Map<string, string>()
  const lines = source.split('\n')
  const declaredStateIds = new Set(
    lines
      .map((line) => line.match(/^\s*state\s+"[^"]+"\s+as\s+([A-Za-z_][A-Za-z0-9_-]*)\s*$/)?.[1])
      .filter((stateId): stateId is string => stateId !== undefined)
  )
  const stateEndpointPattern = String.raw`\[\*\]|[A-Za-z_][A-Za-z0-9_-]*(?:（[^）\n]+）)?`
  const transitionPattern = new RegExp(
    `(${stateEndpointPattern})(\\s*-->\\s*)(${stateEndpointPattern})`
  )
  const normalizedLines = lines.map((line) =>
    line.replace(
      transitionPattern,
      (_match: string, sourceState: string, arrow: string, targetState: string) =>
        `${normalizeMermaidStateEndpoint(sourceState, stateLabels, declaredStateIds)}${arrow}${normalizeMermaidStateEndpoint(targetState, stateLabels, declaredStateIds)}`
    )
  )

  if (stateLabels.size === 0) return source

  const insertIndex = getMermaidStateDeclarationInsertIndex(normalizedLines)
  const declarations = [...stateLabels]
    .map(([stateId, label]) => `  state "${label}" as ${stateId}`)
    .join('\n')

  return [
    ...normalizedLines.slice(0, insertIndex),
    declarations,
    ...normalizedLines.slice(insertIndex)
  ].join('\n')
}

function normalizeMermaidStateEndpoint(
  state: string,
  stateLabels: Map<string, string>,
  declaredStateIds: Set<string>
): string {
  const match = state.match(/^([A-Za-z_][A-Za-z0-9_-]*)(（[^）\n]+）)$/)
  if (!match) return state

  const [, stateId, labelSuffix] = match
  if (!declaredStateIds.has(stateId)) {
    stateLabels.set(stateId, `${stateId}${labelSuffix}`)
  }

  return stateId
}

function getMermaidStateDeclarationInsertIndex(lines: string[]): number {
  let insertIndex = 1

  while (/^\s*direction\s+\S+\s*$/.test(lines[insertIndex] ?? '')) {
    insertIndex += 1
  }

  return insertIndex
}

export function markdownToHtml(markdown: string, options: MarkdownRenderOptions = {}): string {
  const parser = new Marked({
    async: false,
    breaks: false,
    gfm: true,
    renderer: createMarkdownRenderer(options)
  })

  return parser.parse(markdown) as string
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
