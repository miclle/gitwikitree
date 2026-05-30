import type { RepositoryPayload } from '../../shared/types'

function ownerAndRepoFromRoot(rootPath: string): string {
  const parts = rootPath.split(/[\\/]/).filter(Boolean)
  const repo = parts.at(-1)
  const owner = parts.at(-2)

  if (!repo) return ''
  return owner ? `${owner}/${repo}` : repo
}

export function getRepositoryLabel(repository: RepositoryPayload): string {
  const baseLabel = ownerAndRepoFromRoot(repository.rootPath) || repository.name

  if (
    repository.source !== 'worktree' ||
    !repository.activeRef ||
    repository.activeRef === 'HEAD'
  ) {
    return baseLabel
  }

  return `${baseLabel}/${repository.activeRef}`
}
