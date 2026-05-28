import { promises as fs } from 'fs'
import { join } from 'path'
import {
  assertRepositoryPath,
  assertValidRef,
  execFileAsync,
  getBranch,
  getRefs
} from './git-service'
import { loadRepository } from './repository-loader'
import type { RepositoryPayload } from '../shared/types'

function slugifyRef(ref: string): string {
  return ref
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function openWorktree(repoPath: string, ref: string): Promise<RepositoryPayload> {
  const rootPath = await assertRepositoryPath(repoPath)
  const currentBranch = await getBranch(rootPath)

  if (ref === currentBranch) {
    return loadRepository(rootPath)
  }

  await assertValidRef(rootPath, ref)
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

  const refs = await getRefs(rootPath, currentBranch)
  const localBranches = new Set(
    refs.filter((item) => item.type === 'local').map((item) => item.name)
  )
  const remotePrefix = ref.includes('/') ? ref.split('/')[0] : ''
  const remoteTail = remotePrefix ? ref.slice(remotePrefix.length + 1) : ref

  if (remoteTail === currentBranch) {
    return loadRepository(rootPath)
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
