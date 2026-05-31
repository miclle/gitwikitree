import { useCallback, useState } from 'react'
import {
  applyDraftToPreview,
  getEditablePreviewTarget,
  type EditablePreviewTarget
} from './useWorkspaceEditing'
import type { PreviewPayload } from '../../../shared/types'

export type FileViewMode = 'preview' | 'code' | 'split'

interface FileViewModeState {
  editing: boolean
  mode: FileViewMode
  path?: string
}

interface FileViewModeOptions {
  preview: PreviewPayload | undefined
  draftContent: string
  isEditing: boolean
  canEditPreview: boolean
  startEditing: () => void
}

interface FileViewModeControls {
  editablePreviewTarget: EditablePreviewTarget | undefined
  effectiveFileViewMode: FileViewMode
  canSplitPreview: boolean
  isEditorMounted: boolean
  showsEditor: boolean
  showsPreview: boolean
  previewForDisplay: PreviewPayload | undefined
  fileWorkspaceClassName: string
  editorPaneClassName: string
  selectFileViewMode: (mode: FileViewMode) => void
}

export function useFileViewMode({
  preview,
  draftContent,
  isEditing,
  canEditPreview,
  startEditing
}: FileViewModeOptions): FileViewModeControls {
  const [fileViewModeState, setFileViewModeState] = useState<FileViewModeState>({
    editing: false,
    mode: 'preview'
  })
  const editablePreviewTarget = getEditablePreviewTarget(preview)
  const fileViewMode =
    fileViewModeState.path === editablePreviewTarget?.path &&
    fileViewModeState.editing === isEditing
      ? fileViewModeState.mode
      : 'preview'
  const canSplitPreview = Boolean(
    canEditPreview &&
    editablePreviewTarget &&
    ['.md', '.markdown', '.mdx'].includes(editablePreviewTarget.extension.toLocaleLowerCase())
  )
  const effectiveFileViewMode =
    fileViewMode === 'split' && !canSplitPreview
      ? 'code'
      : fileViewMode === 'code' && (!canEditPreview || !isEditing)
        ? 'preview'
        : fileViewMode
  const isEditorMounted = Boolean(editablePreviewTarget && isEditing)
  const showsEditor = Boolean(
    editablePreviewTarget &&
    isEditing &&
    (effectiveFileViewMode === 'code' || effectiveFileViewMode === 'split')
  )
  const showsPreview = Boolean(preview && effectiveFileViewMode !== 'code')
  const previewForDisplay =
    editablePreviewTarget && isEditing ? applyDraftToPreview(preview, draftContent) : preview
  const fileWorkspaceClassName =
    effectiveFileViewMode === 'split' ? 'file-workspace split' : 'file-workspace'
  const editorPaneClassName =
    effectiveFileViewMode === 'split' ? 'file-editor-pane split' : 'file-editor-pane'

  const selectFileViewMode = useCallback(
    (mode: FileViewMode): void => {
      if ((mode === 'code' || mode === 'split') && canEditPreview && !isEditing) {
        startEditing()
      }

      setFileViewModeState({
        editing: Boolean(mode !== 'preview'),
        mode,
        path: editablePreviewTarget?.path
      })
    },
    [canEditPreview, editablePreviewTarget?.path, isEditing, startEditing]
  )

  return {
    editablePreviewTarget,
    effectiveFileViewMode,
    canSplitPreview,
    isEditorMounted,
    showsEditor,
    showsPreview,
    previewForDisplay,
    fileWorkspaceClassName,
    editorPaneClassName,
    selectFileViewMode
  }
}
