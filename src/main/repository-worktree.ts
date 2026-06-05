import { promises as fs } from 'fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
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

function isInsideDirectory(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath)
  return Boolean(relativePath) && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

async function readLinkedGitDir(worktreePath: string): Promise<string> {
  const gitFile = await fs.readFile(join(worktreePath, '.git'), 'utf8')
  const match = /^gitdir:\s*(.+)$/m.exec(gitFile)

  if (!match?.[1]) {
    throw new Error('Worktree .git file does not contain a gitdir link.')
  }

  return match[1].trim()
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function canReplaceWorktreeGitDir(gitDir: string, worktreePath: string): Promise<boolean> {
  if (!(await pathExists(gitDir))) {
    return true
  }

  try {
    const linkedGitFile = await fs.readFile(join(gitDir, 'gitdir'), 'utf8')
    const linkedPath = linkedGitFile.trim()
    const normalizedLinkedPath = isAbsolute(linkedPath) ? linkedPath : resolve(gitDir, linkedPath)
    const expectedGitFile = join(worktreePath, '.git')

    return normalizedLinkedPath === expectedGitFile || !(await pathExists(normalizedLinkedPath))
  } catch {
    return false
  }
}

async function getAvailableWorktreeGitDir(rootPath: string, worktreeName: string): Promise<string> {
  const baseGitDir = join(rootPath, '.git', 'worktrees', worktreeName)

  if (!(await pathExists(baseGitDir))) {
    return baseGitDir
  }

  for (let index = 1; index <= 100; index += 1) {
    const candidate = join(rootPath, '.git', 'worktrees', `${worktreeName}-${index}`)

    if (!(await pathExists(candidate))) {
      return candidate
    }
  }

  throw new Error(`Unable to find an available worktree metadata directory for ${worktreeName}.`)
}

async function rebuildAppManagedWorktreeMetadata(
  worktreePath: string,
  rootPath: string,
  worktreesDir: string,
  branch: string
): Promise<void> {
  if (!isInsideDirectory(worktreesDir, worktreePath)) {
    throw new Error('Refusing to rebuild metadata for a worktree outside .worktrees.')
  }

  const worktreeName = basename(worktreePath)
  const tempWorktreePath = join(
    worktreesDir,
    `.repair-${worktreeName}-${process.pid}-${Date.now()}`
  )

  await execFileAsync('git', ['-C', rootPath, 'worktree', 'add', tempWorktreePath, branch])

  try {
    const tempGitDir = await readLinkedGitDir(tempWorktreePath)
    const defaultGitDir = join(rootPath, '.git', 'worktrees', worktreeName)
    const targetGitDir = (await canReplaceWorktreeGitDir(defaultGitDir, worktreePath))
      ? defaultGitDir
      : await getAvailableWorktreeGitDir(rootPath, worktreeName)

    if (targetGitDir === defaultGitDir) {
      await fs.rm(targetGitDir, { recursive: true, force: true })
    }
    await fs.mkdir(dirname(targetGitDir), { recursive: true })
    await fs.rename(tempGitDir, targetGitDir)
    await fs.writeFile(join(targetGitDir, 'gitdir'), `${join(worktreePath, '.git')}\n`)
    await fs.writeFile(join(worktreePath, '.git'), `gitdir: ${targetGitDir}\n`)
  } finally {
    await fs.rm(tempWorktreePath, { recursive: true, force: true })
  }
}

async function repairAndLoadWorktree(
  worktreePath: string,
  rootPath: string,
  worktreesDir: string,
  branch: string
): Promise<RepositoryPayload> {
  try {
    return await loadWorktree(worktreePath, rootPath)
  } catch {
    const defaultGitDir = join(rootPath, '.git', 'worktrees', basename(worktreePath))

    if (await canReplaceWorktreeGitDir(defaultGitDir, worktreePath)) {
      try {
        await execFileAsync('git', ['-C', rootPath, 'worktree', 'repair', worktreePath])
        const repairedWorktree = await loadWorktree(worktreePath, rootPath)

        if (repairedWorktree.branch === branch) {
          return repairedWorktree
        }
      } catch {
        // Fall through to metadata rebuild when Git cannot repair the existing worktree.
      }
    }

    await rebuildAppManagedWorktreeMetadata(worktreePath, rootPath, worktreesDir, branch)
    return loadWorktree(worktreePath, rootPath)
  }
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
      return repairAndLoadWorktree(worktreePath, rootPath, worktreesDir, targetBranch)
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
