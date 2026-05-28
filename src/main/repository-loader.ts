import { basename, resolve } from 'path'
import {
  assertRepositoryPath,
  getBranch,
  getGitVisibleFiles,
  getRefFiles,
  getRefs,
  getRepositoryRoot
} from './git-service'
import { buildTree } from './repository-tree'
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
  const activeRef = options.ref ?? branch
  const files =
    source === 'git-ref'
      ? await getRefFiles(resolvedPath, activeRef)
      : await getGitVisibleFiles(resolvedPath)

  return {
    name: basename(resolvedPath),
    path: resolvedPath,
    rootPath,
    branch,
    activeRef,
    source,
    editable: source !== 'git-ref',
    refs: refs.map((ref) => ({ ...ref, current: ref.name === activeRef })),
    tree: buildTree(files)
  }
}
