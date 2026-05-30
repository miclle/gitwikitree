import { promises as fs } from 'fs'
import { basename, extname, resolve } from 'path'
import { Marked, type Token } from 'marked'
import { detectPreviewType, textPreviewProbeBytes } from './preview-detection'
import { assertRepositoryPath } from './git-service'
import { loadRepository } from './repository-loader'
import { findDirectoryIndex, getNodeAtPath } from './repository-tree'
import { safeJoin, toPosixPath } from './repository-paths'
import type { PreviewPayload, RepositoryLoadOptions } from '../shared/types'

const maxTextPreviewBytes = 1024 * 1024

type MarkdownAssetPreviewData = {
  dataUrls: Record<string, string>
  paths: Record<string, string>
  absolutePaths?: Record<string, string>
}

function mimeForExtension(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function isExternalResourceUrl(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')
}

function decodeMarkdownPath(path: string): string {
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

function resolveMarkdownAssetPaths(href: string, sourcePath: string): string[] {
  const trimmedHref = href.trim()
  if (!trimmedHref || trimmedHref.startsWith('#') || isExternalResourceUrl(trimmedHref)) {
    return []
  }

  const pathOnly = trimmedHref.split(/[?#]/, 1)[0]
  const decodedPath = decodeMarkdownPath(pathOnly)
  const sourceDirectory = sourcePath.split('/').filter(Boolean).slice(0, -1).join('/')
  const paths: string[] = []
  const addPath = (path: string | undefined): void => {
    if (path && !paths.includes(path)) paths.push(path)
  }

  if (decodedPath.startsWith('/')) {
    addPath(normalizeRepositoryPath(decodedPath.slice(1)))
    return paths
  }

  addPath(normalizeRepositoryPath([sourceDirectory, decodedPath].filter(Boolean).join('/')))

  if (decodedPath.startsWith('../assets/')) {
    addPath(
      normalizeRepositoryPath(
        [sourceDirectory, decodedPath.slice('../'.length)].filter(Boolean).join('/')
      )
    )
  }

  return paths
}

function collectMarkdownImageHrefs(markdown: string): string[] {
  const parser = new Marked({ async: false, gfm: true })
  const hrefs = new Set<string>()
  const collectRawHtmlImageSrcs = (html: string): void => {
    for (const match of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*(["'])([^"']+)\1[^>]*>/gi)) {
      hrefs.add(match[2])
    }
  }
  const visitTableCellTokens = (cells: Array<{ tokens?: Token[] }>): void => {
    for (const cell of cells) {
      if (Array.isArray(cell.tokens)) visit(cell.tokens)
    }
  }
  const visit = (tokens: Token[]): void => {
    for (const token of tokens) {
      if (token.type === 'image') {
        hrefs.add(token.href)
      }

      if (token.type === 'html') {
        collectRawHtmlImageSrcs(token.text)
      }

      if ('tokens' in token && Array.isArray(token.tokens)) {
        visit(token.tokens)
      }

      if ('items' in token && Array.isArray(token.items)) {
        visit(token.items as Token[])
      }

      if (token.type === 'table') {
        visitTableCellTokens(token.header)

        for (const row of token.rows) {
          visitTableCellTokens(row)
        }
      }
    }
  }

  visit(parser.lexer(markdown) as Token[])
  return [...hrefs]
}

async function getMarkdownAssetPreviewData({
  repositoryPath,
  sourcePath,
  markdown
}: {
  repositoryPath: string
  sourcePath: string
  markdown: string
}): Promise<MarkdownAssetPreviewData | undefined> {
  const dataUrls: Record<string, string> = {}
  const paths: Record<string, string> = {}
  const absolutePaths: Record<string, string> = {}

  for (const href of collectMarkdownImageHrefs(markdown)) {
    const assetPaths = resolveMarkdownAssetPaths(href, sourcePath)
    if (assetPaths.length === 0) continue

    for (const assetPath of assetPaths) {
      const extension = extname(assetPath).toLowerCase()
      if (!['image', 'svg'].includes(detectPreviewType(extension))) continue

      try {
        const buffer = await fs.readFile(safeJoin(repositoryPath, assetPath))
        dataUrls[href] = `data:${mimeForExtension(extension)};base64,${buffer.toString('base64')}`
        paths[href] = assetPath
        absolutePaths[href] = safeJoin(repositoryPath, assetPath)
        break
      } catch {
        // Missing or unreadable Markdown images should leave the original alt text visible.
      }
    }
  }

  return Object.keys(dataUrls).length > 0
    ? {
        dataUrls,
        paths,
        ...(Object.keys(absolutePaths).length > 0 ? { absolutePaths } : {})
      }
    : undefined
}

async function readFileSample(path: string, bytes: number): Promise<Buffer> {
  const file = await fs.open(path, 'r')

  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await file.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await file.close()
  }
}

export async function getPreview(
  repoPath: string,
  relativePath = '',
  options: RepositoryLoadOptions = {}
): Promise<PreviewPayload> {
  const repository = await loadRepository(repoPath, options)
  const node = relativePath ? getNodeAtPath(repository.tree, relativePath) : undefined
  const target = safeJoin(repository.path, relativePath)
  const stats = await fs.stat(target)

  if (stats.isDirectory()) {
    const children = relativePath ? (node?.children ?? []) : repository.tree
    const readme = (relativePath ? node?.index : repository.index) ?? findDirectoryIndex(children)
    const modifiedAt = stats.mtime.toISOString()

    if (readme) {
      const content = await fs.readFile(safeJoin(repository.path, readme.path), 'utf8')
      const markdownAssetPreviewData = await getMarkdownAssetPreviewData({
        repositoryPath: repository.path,
        sourcePath: readme.path,
        markdown: content
      })
      return {
        kind: 'directory',
        path: toPosixPath(relativePath),
        modifiedAt,
        readme: {
          path: readme.path,
          content,
          ...(markdownAssetPreviewData
            ? {
                markdownAssetDataUrls: markdownAssetPreviewData.dataUrls,
                markdownAssetPaths: markdownAssetPreviewData.paths,
                ...(markdownAssetPreviewData.absolutePaths
                  ? { markdownAssetAbsolutePaths: markdownAssetPreviewData.absolutePaths }
                  : {})
              }
            : {})
        }
      }
    }

    return {
      kind: 'directory',
      path: toPosixPath(relativePath),
      modifiedAt,
      entries: children.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type
      }))
    }
  }

  const size = stats.size
  const extension = extname(target).toLowerCase()
  let previewType = detectPreviewType(extension)

  if (previewType === 'unsupported' && size <= maxTextPreviewBytes) {
    const sample = await readFileSample(target, Math.min(size, textPreviewProbeBytes))

    previewType = detectPreviewType(extension, sample)
  }

  const payload = {
    kind: 'file' as const,
    path: toPosixPath(relativePath),
    name: basename(target),
    extension,
    previewType,
    editable: repository.editable,
    size,
    modifiedAt: stats.mtime.toISOString()
  }

  if (previewType === 'image') {
    const buffer = await fs.readFile(target)
    return {
      ...payload,
      dataUrl: `data:${mimeForExtension(extension)};base64,${buffer.toString('base64')}`
    }
  }

  if (previewType === 'svg') {
    return {
      ...payload,
      content: await fs.readFile(target, 'utf8')
    }
  }

  if (previewType !== 'unsupported' && size <= maxTextPreviewBytes) {
    const content = await fs.readFile(target, 'utf8')
    const markdownAssetPreviewData =
      previewType === 'markdown'
        ? await getMarkdownAssetPreviewData({
            repositoryPath: repository.path,
            sourcePath: toPosixPath(relativePath),
            markdown: content
          })
        : undefined

    return {
      ...payload,
      content,
      ...(markdownAssetPreviewData
        ? {
            markdownAssetDataUrls: markdownAssetPreviewData.dataUrls,
            markdownAssetPaths: markdownAssetPreviewData.paths,
            ...(markdownAssetPreviewData.absolutePaths
              ? { markdownAssetAbsolutePaths: markdownAssetPreviewData.absolutePaths }
              : {})
          }
        : {})
    }
  }

  return payload
}

export async function saveFile(
  repoPath: string,
  relativePath: string,
  content: string
): Promise<PreviewPayload> {
  const rootPath = await assertRepositoryPath(repoPath)
  const target = safeJoin(rootPath, relativePath)

  await fs.mkdir(resolve(target, '..'), { recursive: true })
  await fs.writeFile(target, content, 'utf8')
  return getPreview(rootPath, relativePath, { source: 'working-tree' })
}
