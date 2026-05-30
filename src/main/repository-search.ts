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

type SearchCandidate = {
  path: string
  name: string
  type: 'file' | 'directory'
}

type ScoredSearchResult = RepositorySearchResult & {
  score: number
}

function isSearchablePreviewType(type: ReturnType<typeof detectPreviewType>): boolean {
  return type === 'text' || type === 'markdown' || type === 'html' || type === 'svg'
}

function flattenTree(
  nodes: TreeNode[],
  rootIndex?: { name: string; path: string }
): SearchCandidate[] {
  return nodes
    .flatMap((node) => [
      { path: node.path, name: node.name, type: node.type },
      ...(node.index
        ? [{ path: node.index.path, name: node.index.name, type: 'file' as const }]
        : []),
      ...(node.children ? flattenTree(node.children) : [])
    ])
    .concat(rootIndex ? [{ path: rootIndex.path, name: rootIndex.name, type: 'file' }] : [])
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

function createSnippet(content: string, query: string): { snippet: string; lineNumber: number } {
  const lowerQuery = query.toLocaleLowerCase()
  const lines = content.split(/\r?\n/)
  const matchedLineIndex = lines.findIndex((line) => line.toLocaleLowerCase().includes(lowerQuery))
  const lineIndex = matchedLineIndex >= 0 ? matchedLineIndex : 0
  const line = lines[lineIndex] ?? ''
  const matchIndex = line.toLocaleLowerCase().indexOf(lowerQuery)
  const start = matchIndex > 40 ? matchIndex - 40 : 0
  const end =
    matchIndex >= 0
      ? Math.min(line.length, matchIndex + query.length + 80)
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
  relativePath: string
): Promise<string | undefined> {
  const target = safeJoin(repository.path, relativePath)
  const stats = await fs.stat(target)
  if (!stats.isFile() || stats.size > maxSearchBytes) return undefined

  const file = await fs.open(target, 'r')
  try {
    const sampleBuffer = Buffer.alloc(Math.min(stats.size, textPreviewProbeBytes))
    const { bytesRead } = await file.read(sampleBuffer, 0, sampleBuffer.length, 0)
    const previewType = detectPreviewType(
      extname(relativePath).toLocaleLowerCase(),
      sampleBuffer.subarray(0, bytesRead)
    )
    if (!isSearchablePreviewType(previewType)) {
      return undefined
    }
  } finally {
    await file.close()
  }

  return fs.readFile(target, 'utf8')
}

export async function searchRepository(
  repoPath: string,
  query: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositorySearchResult[]> {
  const terms = normalizeQuery(query)
  if (terms.length === 0) return []

  const repository = await loadRepository(repoPath, options)
  const candidates = flattenTree(repository.tree, repository.index)
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

    const content = await readSearchableWorkingTreeFile(repository, candidate.path)
    if (!content || !matchesAllTerms(content, terms)) continue

    const { snippet, lineNumber } = createSnippet(content, query.trim())
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
