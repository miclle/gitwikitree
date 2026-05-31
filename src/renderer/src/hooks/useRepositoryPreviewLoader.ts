import { useCallback, useState } from 'react'
import type { PreviewPayload, RepositoryPayload } from '../../../shared/types'

export function useRepositoryPreviewLoader(repository: RepositoryPayload | undefined): {
  preview: PreviewPayload | undefined
  setPreview: (preview: PreviewPayload | undefined) => void
  previewLoading: boolean
  error: string | undefined
  setError: (error: string | undefined) => void
  loadPreview: (path: string, repo?: RepositoryPayload) => Promise<PreviewPayload | undefined>
} {
  const [preview, setPreview] = useState<PreviewPayload | undefined>()
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const loadPreview = useCallback(
    async (path: string, repo = repository): Promise<PreviewPayload | undefined> => {
      if (!repo) return undefined

      setPreviewLoading(true)
      setError(undefined)

      try {
        const nextPreview = await window.api.previewPath(repo.path, path, {
          source: repo.source,
          rootPath: repo.rootPath
        })
        setPreview(nextPreview)
        return nextPreview
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        return undefined
      } finally {
        setPreviewLoading(false)
      }
    },
    [repository]
  )

  return {
    preview,
    setPreview,
    previewLoading,
    error,
    setError,
    loadPreview
  }
}
