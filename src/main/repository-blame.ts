import { promises as fs } from 'fs'
import { getBlameLines } from './git-service'
import { loadRepository } from './repository-loader'
import { safeJoin, toPosixPath } from './repository-paths'
import type { GitBlamePayload, RepositoryLoadOptions } from '../shared/types'

export async function getBlame(
  repoPath: string,
  relativePath: string,
  options: RepositoryLoadOptions = {}
): Promise<GitBlamePayload> {
  const repository = await loadRepository(repoPath, options)
  const normalizedPath = toPosixPath(relativePath)
  const target = safeJoin(repository.path, normalizedPath)
  const stats = await fs.stat(target)

  if (!stats.isFile()) {
    throw new Error('Selected path is not a file.')
  }

  return {
    path: normalizedPath,
    lines: await getBlameLines(repository.path, normalizedPath)
  }
}
