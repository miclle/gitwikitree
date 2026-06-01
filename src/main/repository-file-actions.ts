import { promises as fs } from 'fs'
import { dirname, join } from 'path'
import type { RepositoryLoadOptions, RepositoryPayload } from '../shared/types'
import { assertRepositoryPath } from './git-service'
import { loadRepository } from './repository-loader'
import { assertSafeGitRelativePath, safeJoin, toPosixPath } from './repository-paths'

function assertSafeFileName(name: string): void {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error('Invalid file name.')
  }

  if (name === '.' || name === '..') {
    throw new Error('Invalid file name.')
  }
}

export async function renamePath(
  repoPath: string,
  relativePath: string,
  nextName: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositoryPayload> {
  await assertRepositoryPath(repoPath)
  assertSafeGitRelativePath(relativePath)
  assertSafeFileName(nextName)

  const repository = await loadRepository(repoPath, options)
  const sourcePath = safeJoin(repository.path, relativePath)
  const targetRelativePath = toPosixPath(join(dirname(relativePath), nextName))
  const targetPath = safeJoin(repository.path, targetRelativePath)

  if (sourcePath === targetPath) return repository

  await fs.rename(sourcePath, targetPath)
  return loadRepository(repository.path, options)
}

export async function deletePath(
  repoPath: string,
  relativePath: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositoryPayload> {
  await assertRepositoryPath(repoPath)
  assertSafeGitRelativePath(relativePath)

  const repository = await loadRepository(repoPath, options)
  const targetPath = safeJoin(repository.path, relativePath)

  await fs.rm(targetPath, { recursive: true, force: false })
  return loadRepository(repository.path, options)
}
