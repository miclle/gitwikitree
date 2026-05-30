import { basename, resolve } from 'path'
import {
  assertRepositoryPath,
  getBranch,
  getGitVisibleFiles,
  getRefs,
  getRepositoryRoot
} from './git-service'
import { buildRepositoryTree } from './repository-tree'
import type { RepositoryLoadOptions, RepositoryPayload } from '../shared/types'

export async function loadRepository(
  repoPath: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositoryPayload> {
  const resolvedPath = await assertRepositoryPath(repoPath)
  const rootPath = options.rootPath
    ? resolve(options.rootPath)
    : await getRepositoryRoot(resolvedPath)
  const source = options.source ?? 'working-tree'
  const currentBranch = await getBranch(resolvedPath)
  const [branch, refs] = await Promise.all([
    Promise.resolve(currentBranch),
    getRefs(resolvedPath, currentBranch)
  ])
  const activeRef = branch
  const files = await getGitVisibleFiles(resolvedPath)

  const repositoryTree = buildRepositoryTree(files)

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
