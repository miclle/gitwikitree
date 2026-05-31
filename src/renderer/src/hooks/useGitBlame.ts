import { useEffect, useState } from 'react'
import type { EditablePreviewTarget } from './useWorkspaceEditing'
import type { GitBlamePayload, RepositoryPayload } from '../../../shared/types'

type GitBlameState = {
  key: string
  blame?: GitBlamePayload
  loading: boolean
  error?: string
}

export function useGitBlame({
  repository,
  target,
  active
}: {
  repository: RepositoryPayload | undefined
  target: EditablePreviewTarget | undefined
  active: boolean
}): {
  blame: GitBlamePayload | undefined
  blameLoading: boolean
  blameError: string | undefined
} {
  const key = repository && target ? `${repository.path}:${repository.source}:${target.path}` : ''
  const repositoryPath = repository?.path
  const repositorySource = repository?.source
  const repositoryRootPath = repository?.rootPath
  const targetPath = target?.path
  const [state, setState] = useState<GitBlameState>()
  const hasActiveTarget = Boolean(active && repositoryPath && targetPath)

  useEffect(() => {
    if (!active || !repositoryPath || !targetPath) return

    let cancelled = false
    window.api
      .getBlame(repositoryPath, targetPath, {
        source: repositorySource,
        rootPath: repositoryRootPath
      })
      .then((blame) => {
        if (!cancelled) setState({ key, blame, loading: false })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            key,
            loading: false,
            error: error instanceof Error ? error.message : 'Unable to load blame.'
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [active, key, repositoryPath, repositoryRootPath, repositorySource, targetPath])

  return {
    blame: state?.key === key ? state.blame : undefined,
    blameLoading: Boolean(hasActiveTarget && (state?.key !== key || state.loading)),
    blameError: active && state?.key === key ? state.error : undefined
  }
}
