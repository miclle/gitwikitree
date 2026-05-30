import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { resolve } from 'path'
import { promisify } from 'util'
import type { RepositoryPayload } from '../shared/types'

export const execFileAsync = promisify(execFile)

export async function assertRepositoryPath(repoPath: string): Promise<string> {
  const resolved = resolve(repoPath)
  const stats = await fs.stat(resolved)

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.')
  }

  await execFileAsync('git', ['-C', resolved, 'rev-parse', '--show-toplevel'])
  return resolved
}

export async function getRepositoryRoot(repoPath: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--show-toplevel'])
  return stdout.trim()
}

export async function getBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'branch', '--show-current'])
    return stdout.trim() || 'HEAD'
  } catch {
    return 'HEAD'
  }
}

export async function getRefs(
  repoPath: string,
  currentBranch: string
): Promise<RepositoryPayload['refs']> {
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'for-each-ref',
    '--format=%(refname:short)%09%(refname)',
    'refs/heads',
    'refs/remotes'
  ])

  const seen = new Set<string>()
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, fullName] = line.split('\t')
      return {
        name,
        type: fullName?.startsWith('refs/remotes/') ? ('remote' as const) : ('local' as const),
        current: name === currentBranch
      }
    })
    .filter((ref) => {
      if (!ref.name || ref.name.endsWith('/HEAD') || seen.has(ref.name)) return false
      seen.add(ref.name)
      return true
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'local' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

export async function getGitVisibleFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'ls-files',
    '-co',
    '--exclude-standard'
  ])

  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => Boolean(file) && !file.startsWith('.worktrees/'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export async function assertValidRef(repoPath: string, ref: string): Promise<void> {
  if (!ref || ref.includes('\0') || ref.startsWith('-')) {
    throw new Error('Invalid git ref.')
  }

  await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--verify', `${ref}^{commit}`])
}

export async function assertLocalBranch(repoPath: string, branch: string): Promise<void> {
  if (!branch || branch.includes('\0') || branch.startsWith('-')) {
    throw new Error('Invalid git branch.')
  }

  await execFileAsync('git', ['-C', repoPath, 'show-ref', '--verify', `refs/heads/${branch}`])
}

export async function switchLocalBranch(repoPath: string, branch: string): Promise<void> {
  await assertLocalBranch(repoPath, branch)
  await execFileAsync('git', ['-C', repoPath, 'switch', branch])
}
