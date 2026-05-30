import { realpath } from 'fs/promises'
import { assertRepositoryPath, getWorktrees, switchLocalBranch } from './git-service'
import { loadRepository } from './repository-loader'
import type { RepositoryPayload, RepositorySource } from '../shared/types'

async function getWorktreeSource(
  worktreePath: string,
  rootPath: string
): Promise<RepositorySource> {
  try {
    return (await realpath(worktreePath)) === (await realpath(rootPath))
      ? 'working-tree'
      : 'worktree'
  } catch {
    return worktreePath === rootPath ? 'working-tree' : 'worktree'
  }
}

export async function checkoutBranch(repoPath: string, branch: string): Promise<RepositoryPayload> {
  const repositoryPath = await assertRepositoryPath(repoPath)
  const worktrees = await getWorktrees(repositoryPath)
  const rootPath = worktrees[0]?.path ?? repositoryPath
  const existingWorktree = worktrees.find((worktree) => worktree.branch === branch)

  if (existingWorktree) {
    return loadRepository(existingWorktree.path, {
      source: await getWorktreeSource(existingWorktree.path, rootPath),
      rootPath
    })
  }

  await switchLocalBranch(rootPath, branch)
  return loadRepository(rootPath, {
    source: await getWorktreeSource(rootPath, rootPath),
    rootPath
  })
}
