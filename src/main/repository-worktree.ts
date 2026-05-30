import { promises as fs } from 'fs'
import { join } from 'path'
import {
  assertRepositoryPath,
  assertValidRef,
  execFileAsync,
  getBranch,
  getRefs,
  getWorktrees,
  type GitWorktree
} from './git-service'
import { loadRepository } from './repository-loader'
import type { RepositoryPayload, RepositorySource } from '../shared/types'

function slugifyRef(ref: string): string {
  return ref
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function getWorktreeSource(worktreePath: string, rootPath: string): RepositorySource {
  return worktreePath === rootPath ? 'working-tree' : 'worktree'
}

function findWorktreeForBranch(worktrees: GitWorktree[], branch: string): GitWorktree | undefined {
  return worktrees.find((worktree) => worktree.branch === branch)
}

function loadWorktree(worktreePath: string, rootPath: string): Promise<RepositoryPayload> {
  return loadRepository(worktreePath, {
    source: getWorktreeSource(worktreePath, rootPath),
    rootPath
  })
}

export async function openWorktree(repoPath: string, ref: string): Promise<RepositoryPayload> {
  const resolvedPath = await assertRepositoryPath(repoPath)
  const worktrees = await getWorktrees(resolvedPath)
  const rootPath = worktrees[0]?.path ?? resolvedPath
  const currentBranch = await getBranch(rootPath)

  await assertValidRef(rootPath, ref)

  const refs = await getRefs(rootPath, currentBranch)
  const localBranches = new Set(
    refs.filter((item) => item.type === 'local').map((item) => item.name)
  )
  const remotePrefix = ref.includes('/') ? ref.split('/')[0] : ''
  const remoteTail = remotePrefix ? ref.slice(remotePrefix.length + 1) : ref
  const targetBranch = localBranches.has(ref) ? ref : remoteTail
  const existingWorktree = findWorktreeForBranch(worktrees, targetBranch)

  if (existingWorktree) {
    return loadWorktree(existingWorktree.path, rootPath)
  }

  const worktreesDir = join(rootPath, '.worktrees')
  const worktreePath = join(worktreesDir, slugifyRef(ref) || 'branch')

  try {
    const stats = await fs.stat(worktreePath)
    if (stats.isDirectory()) {
      return loadRepository(worktreePath, { source: 'worktree', rootPath })
    }
  } catch {
    await fs.mkdir(worktreesDir, { recursive: true })
  }

  if (localBranches.has(ref)) {
    await execFileAsync('git', ['-C', rootPath, 'worktree', 'add', worktreePath, ref])
  } else if (remotePrefix && !localBranches.has(remoteTail)) {
    await execFileAsync('git', [
      '-C',
      rootPath,
      'worktree',
      'add',
      '-b',
      remoteTail,
      worktreePath,
      ref
    ])
  } else {
    await execFileAsync('git', ['-C', rootPath, 'worktree', 'add', worktreePath, remoteTail])
  }

  return loadRepository(worktreePath, { source: 'worktree', rootPath })
}
