import { useCallback, useEffect, useRef } from 'react'
import type { PreviewPayload } from '../../../shared/types'

const homeFilePreviewReloadDelayMs = 450

export function useHomeFileDirectoryPreviewReload({
  preview,
  selectedPath,
  loadPreview
}: {
  preview: PreviewPayload | undefined
  selectedPath: string
  loadPreview: (path: string) => Promise<PreviewPayload | undefined>
}): {
  scheduleHomeFileDirectoryPreviewReload: () => void
} {
  const homeFilePreviewReloadTimeoutRef = useRef<number | undefined>(undefined)

  const clearHomeFileDirectoryPreviewReload = useCallback((): void => {
    if (homeFilePreviewReloadTimeoutRef.current) {
      window.clearTimeout(homeFilePreviewReloadTimeoutRef.current)
      homeFilePreviewReloadTimeoutRef.current = undefined
    }
  }, [])

  const scheduleHomeFileDirectoryPreviewReload = useCallback((): void => {
    clearHomeFileDirectoryPreviewReload()

    if (preview?.kind !== 'directory') return

    const directoryPath = preview.path
    homeFilePreviewReloadTimeoutRef.current = window.setTimeout(() => {
      homeFilePreviewReloadTimeoutRef.current = undefined
      void loadPreview(directoryPath)
    }, homeFilePreviewReloadDelayMs)
  }, [clearHomeFileDirectoryPreviewReload, loadPreview, preview])

  useEffect(() => {
    if (preview?.kind === 'directory' && preview.path === selectedPath) return

    clearHomeFileDirectoryPreviewReload()
  }, [clearHomeFileDirectoryPreviewReload, preview, selectedPath])

  useEffect(() => {
    return clearHomeFileDirectoryPreviewReload
  }, [clearHomeFileDirectoryPreviewReload])

  return { scheduleHomeFileDirectoryPreviewReload }
}
