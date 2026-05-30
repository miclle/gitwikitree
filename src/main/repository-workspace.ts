import { assertRepositoryPath, switchLocalBranch } from './git-service'
import { loadRepository } from './repository-loader'
import type { RepositoryPayload } from '../shared/types'

export async function checkoutBranch(repoPath: string, branch: string): Promise<RepositoryPayload> {
  const rootPath = await assertRepositoryPath(repoPath)

  await switchLocalBranch(rootPath, branch)
  return loadRepository(rootPath)
}
