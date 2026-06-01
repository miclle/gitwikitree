import { promises as fs } from 'fs'
import { basename, extname } from 'path'
import { detectPreviewType, textPreviewProbeBytes } from './preview-detection'
import { loadRepository } from './repository-loader'
import { safeJoin } from './repository-paths'
import type {
  RepositoryLoadOptions,
  RepositoryPayload,
  RepositorySearchResult,
  TreeNode
} from '../shared/types'

const maxSearchBytes = 1024 * 1024
const searchResultLimit = 100
const maxSearchCacheWorkspaces = 8
const maxSearchCacheEntriesPerWorkspace = 1000

type SearchCandidate = {
  path: string
  name: string
  type: 'file' | 'directory'
}

type ScoredSearchResult = RepositorySearchResult & {
  score: number
}

type CachedSearchContent = {
  mtimeMs: number
  size: number
  content?: string
}

type WorkspaceSearchContentCache = Map<string, CachedSearchContent>

const searchContentCache = new Map<string, WorkspaceSearchContentCache>()

function isSearchablePreviewType(type: ReturnType<typeof detectPreviewType>): boolean {
  return type === 'text' || type === 'markdown' || type === 'html' || type === 'svg'
}

function flattenTree(nodes: TreeNode[]): SearchCandidate[] {
  return nodes.flatMap((node) => [
    { path: node.path, name: node.name, type: node.type },
    ...(node.children ? flattenTree(node.children) : [])
  ])
}

function normalizeQuery(query: string): string[] {
  return query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
}

function matchesAllTerms(text: string, terms: string[]): boolean {
  const haystack = text.toLocaleLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function pathScore(candidate: SearchCandidate, terms: string[]): number {
  const name = candidate.name.toLocaleLowerCase()
  const path = candidate.path.toLocaleLowerCase()
  const firstTerm = terms[0] ?? ''

  if (name === firstTerm) return 0
  if (name.startsWith(firstTerm)) return 1
  if (name.includes(firstTerm)) return 2
  if (path.includes(firstTerm)) return 3
  return 4
}

function getWorkspaceCacheKey(repository: RepositoryPayload): string {
  return [repository.source, repository.rootPath, repository.path, repository.activeRef].join('\0')
}

function getWorkspaceSearchContentCache(
  repository: RepositoryPayload
): WorkspaceSearchContentCache {
  const cacheKey = getWorkspaceCacheKey(repository)
  const existing = searchContentCache.get(cacheKey)
  if (existing) {
    searchContentCache.delete(cacheKey)
    searchContentCache.set(cacheKey, existing)
    return existing
  }

  const cache = new Map<string, CachedSearchContent>()
  searchContentCache.set(cacheKey, cache)
  pruneSearchContentCache()
  return cache
}

function pruneSearchContentCache(): void {
  while (searchContentCache.size > maxSearchCacheWorkspaces) {
    const oldestKey = searchContentCache.keys().next().value
    if (!oldestKey) return
    searchContentCache.delete(oldestKey)
  }
}

function getCachedSearchContent(
  cache: WorkspaceSearchContentCache,
  relativePath: string,
  stats: { mtimeMs: number; size: number }
): CachedSearchContent | undefined {
  const cached = cache.get(relativePath)

  if (!cached || cached.mtimeMs !== stats.mtimeMs || cached.size !== stats.size) {
    return undefined
  }

  cache.delete(relativePath)
  cache.set(relativePath, cached)
  return cached
}

function setCachedSearchContent(
  cache: WorkspaceSearchContentCache,
  relativePath: string,
  item: CachedSearchContent
): void {
  cache.delete(relativePath)
  cache.set(relativePath, item)

  while (cache.size > maxSearchCacheEntriesPerWorkspace) {
    const oldestPath = cache.keys().next().value
    if (!oldestPath) return
    cache.delete(oldestPath)
  }
}

function pruneWorkspaceSearchContentCache(
  cache: WorkspaceSearchContentCache,
  candidates: SearchCandidate[]
): void {
  const candidatePaths = new Set(
    candidates.filter((candidate) => candidate.type === 'file').map((candidate) => candidate.path)
  )

  for (const path of cache.keys()) {
    if (!candidatePaths.has(path)) {
      cache.delete(path)
    }
  }
}

function createSnippet(content: string, terms: string[]): { snippet: string; lineNumber: number } {
  const lines = content.split(/\r?\n/)
  const matchedLineIndex = lines.findIndex((line) => matchesAllTerms(line, terms))
  const lineIndex = matchedLineIndex >= 0 ? matchedLineIndex : 0
  const line = lines[lineIndex] ?? ''
  const lowerLine = line.toLocaleLowerCase()
  const matchIndexes = terms
    .map((term) => {
      const index = lowerLine.indexOf(term)
      return index >= 0 ? { index, length: term.length } : undefined
    })
    .filter((match): match is { index: number; length: number } => Boolean(match))
  const firstMatchIndex = Math.min(...matchIndexes.map((match) => match.index))
  const lastMatch = matchIndexes.reduce(
    (last, match) => Math.max(last, match.index + match.length),
    -1
  )
  const matchIndex = Number.isFinite(firstMatchIndex) ? firstMatchIndex : -1
  const start = matchIndex > 40 ? matchIndex - 40 : 0
  const end =
    matchIndex >= 0
      ? Math.min(line.length, Math.max(lastMatch, matchIndex) + 80)
      : Math.min(line.length, 120)

  return {
    snippet: `${start > 0 ? '...' : ''}${line.slice(start, end).trim()}${
      end < line.length ? '...' : ''
    }`,
    lineNumber: lineIndex + 1
  }
}

async function readSearchableWorkingTreeFile(
  repository: RepositoryPayload,
  relativePath: string,
  cache: WorkspaceSearchContentCache
): Promise<string | undefined> {
  const target = safeJoin(repository.path, relativePath)
  const stats = await fs.stat(target)
  const cached = getCachedSearchContent(cache, relativePath, stats)
  if (cached) return cached.content

  if (!stats.isFile() || stats.size > maxSearchBytes) {
    setCachedSearchContent(cache, relativePath, { mtimeMs: stats.mtimeMs, size: stats.size })
    return undefined
  }

  const file = await fs.open(target, 'r')
  try {
    const sampleBuffer = Buffer.alloc(Math.min(stats.size, textPreviewProbeBytes))
    const { bytesRead } = await file.read(sampleBuffer, 0, sampleBuffer.length, 0)
    const previewType = detectPreviewType(
      extname(relativePath).toLocaleLowerCase(),
      sampleBuffer.subarray(0, bytesRead)
    )
    if (!isSearchablePreviewType(previewType)) {
      setCachedSearchContent(cache, relativePath, { mtimeMs: stats.mtimeMs, size: stats.size })
      return undefined
    }
  } finally {
    await file.close()
  }

  const content = await fs.readFile(target, 'utf8')
  setCachedSearchContent(cache, relativePath, { mtimeMs: stats.mtimeMs, size: stats.size, content })
  return content
}

export async function searchRepository(
  repoPath: string,
  query: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositorySearchResult[]> {
  const terms = normalizeQuery(query)
  if (terms.length === 0) return []

  const repository = await loadRepository(repoPath, options)
  const candidates = flattenTree(repository.tree)
  const workspaceSearchContentCache = getWorkspaceSearchContentCache(repository)
  pruneWorkspaceSearchContentCache(workspaceSearchContentCache, candidates)
  const pathMatchedPaths = new Set<string>()
  const results: ScoredSearchResult[] = []

  for (const candidate of candidates) {
    if (matchesAllTerms(candidate.path, terms)) {
      pathMatchedPaths.add(candidate.path)
      results.push({
        path: candidate.path,
        name: candidate.name,
        type: candidate.type,
        matchType: 'path',
        score: pathScore(candidate, terms)
      })
    }
  }

  for (const candidate of candidates) {
    if (pathMatchedPaths.has(candidate.path)) continue
    if (candidate.type !== 'file') continue
    if (results.length >= searchResultLimit) break

    const content = await readSearchableWorkingTreeFile(
      repository,
      candidate.path,
      workspaceSearchContentCache
    )
    if (!content || !matchesAllTerms(content, terms)) continue

    const { snippet, lineNumber } = createSnippet(content, terms)
    results.push({
      path: candidate.path,
      name: basename(candidate.path),
      type: 'file',
      matchType: 'content',
      snippet,
      lineNumber,
      score: 10 + lineNumber
    })
  }

  return results
    .sort(
      (a, b) =>
        a.score - b.score || a.path.localeCompare(b.path, undefined, { sensitivity: 'base' })
    )
    .slice(0, searchResultLimit)
    .map((result) => ({
      path: result.path,
      name: result.name,
      type: result.type,
      matchType: result.matchType,
      snippet: result.snippet,
      lineNumber: result.lineNumber
    }))
}
