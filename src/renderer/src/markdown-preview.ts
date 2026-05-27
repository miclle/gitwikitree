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
