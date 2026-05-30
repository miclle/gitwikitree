import { basename, resolve } from 'path'
import { realpath } from 'fs/promises'
import {
  assertRepositoryPath,
  getBranch,
  getModifiedFiles,
  getRefs,
  getRepositoryRoot,
  getWorktrees
} from './git-service'
import { getWorkspaceFiles } from './repository-files'
import { buildRepositoryTree } from './repository-tree'
import type { RepositoryLoadOptions, RepositoryPayload } from '../shared/types'

async function isSamePath(firstPath: string, secondPath: string): Promise<boolean> {
  try {
    return (await realpath(firstPath)) === (await realpath(secondPath))
  } catch {
    return firstPath === secondPath
  }
}

export async function loadRepository(
  repoPath: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositoryPayload> {
  const resolvedPath = await assertRepositoryPath(repoPath)
  const worktrees = options.rootPath ? [] : await getWorktrees(resolvedPath)
  const rootPath = options.rootPath
    ? await assertRepositoryPath(resolve(options.rootPath))
    : (worktrees[0]?.path ?? (await getRepositoryRoot(resolvedPath)))
  const source =
    options.source ?? ((await isSamePath(resolvedPath, rootPath)) ? 'working-tree' : 'worktree')
  const currentBranch = await getBranch(resolvedPath)
  const [branch, refs] = await Promise.all([
    Promise.resolve(currentBranch),
    getRefs(resolvedPath, currentBranch)
  ])
  const activeRef = branch
  const [files, modifiedFiles] = await Promise.all([
    getWorkspaceFiles(resolvedPath),
    getModifiedFiles(resolvedPath)
  ])

  const repositoryTree = buildRepositoryTree(files, modifiedFiles)

  return {
    name: basename(resolvedPath),
    path: resolvedPath,
    rootPath,
    branch,
    activeRef,
    source,
    editable: true,
    refs: refs.map((ref) => ({ ...ref, current: ref.name === activeRef })),
    tree: repositoryTree.tree,
    index: repositoryTree.index
  }
}
