import { Marked, Renderer, type Tokens } from 'marked'
import { highlightCodeBlock } from './code-highlight'

export type MarkdownPreview = {
  title?: string
  content: string
}

export type MarkdownRenderOptions = {
  resolveImageSrc?: (href: string) => string | undefined
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

function rewriteRawHtmlImageSources(
  html: string,
  resolveImageSrc: (href: string) => string | undefined
): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)([^>]*>)/gi,
    (match, prefix: string, quote: string, href: string, closingQuote: string, suffix: string) => {
      const src = resolveImageSrc(href)
      if (!src) return match

      return `${prefix}${quote}${escapeHtml(src)}${closingQuote}${suffix}`
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
    return options.resolveImageSrc
      ? rewriteRawHtmlImageSources(text, options.resolveImageSrc)
      : text
  }

  renderer.image = function ({ href, title, text, tokens }: Tokens.Image): string {
    const alt = tokens ? this.parser.parseInline(tokens, this.parser.textRenderer) : text
    const src = options.resolveImageSrc?.(href) ?? href
    const titleAttribute = title ? ` title="${escapeHtml(title)}"` : ''

    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttribute}>`
  }

  renderer.code = function ({ text, lang }: Tokens.Code): string {
    const language = lang?.match(/^\S+/)?.[0]
    return `<div class="markdown-code-block"><button type="button" class="markdown-code-copy" data-copy-code="true" aria-label="Copy code" title="Copy code">Copy</button><pre><code class="hljs${language ? ` language-${escapeHtml(language)}` : ''}">${highlightCodeBlock(
      text,
      language
    )}</code></pre></div>\n`
  }

  return renderer
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
