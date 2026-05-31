import { useCallback, useState } from 'react'
import type { EditablePreviewTarget } from './useRepositoryWorkspace'
import type { EditorStatusBarState } from '../status-bar'
import type { PreviewPayload } from '../../../shared/types'

interface PreviewStatusMetadataOptions {
  preview: PreviewPayload | undefined
  editablePreviewTarget: EditablePreviewTarget | undefined
  showsEditor: boolean
}

interface PreviewStatusMetadata {
  activePdfPageCount: number | undefined
  editorStatusForStatusBar: EditorStatusBarState | undefined
  setEditorStatus: (status: EditorStatusBarState) => void
  handlePdfPageCountChange: (count: number | undefined) => void
}

export function usePreviewStatusMetadata({
  preview,
  editablePreviewTarget,
  showsEditor
}: PreviewStatusMetadataOptions): PreviewStatusMetadata {
  const [pdfPageCount, setPdfPageCount] = useState<{ path: string; count: number | undefined }>()
  const [editorStatus, setEditorStatus] = useState<EditorStatusBarState | undefined>()
  const activePdfPath =
    preview?.kind === 'file' && preview.previewType === 'pdf' ? preview.path : undefined
  const activePdfPageCount =
    pdfPageCount && pdfPageCount.path === activePdfPath ? pdfPageCount.count : undefined
  const editorStatusWithFileMetadata =
    editorStatus && editablePreviewTarget
      ? {
          ...editorStatus,
          encoding: editablePreviewTarget.encoding ?? editorStatus.encoding,
          modifiedAt: editablePreviewTarget.modifiedAt,
          lastChange: editablePreviewTarget.lastChange
        }
      : editorStatus
  const editorStatusForStatusBar = showsEditor ? editorStatusWithFileMetadata : undefined

  const handlePdfPageCountChange = useCallback(
    (count: number | undefined): void => {
      if (!activePdfPath) return
      setPdfPageCount({ path: activePdfPath, count })
    },
    [activePdfPath]
  )

  return {
    activePdfPageCount,
    editorStatusForStatusBar,
    setEditorStatus,
    handlePdfPageCountChange
  }
}
