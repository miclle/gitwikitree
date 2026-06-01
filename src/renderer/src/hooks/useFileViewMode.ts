import { useCallback, useEffect, useState } from 'react'
import {
  applyDraftToPreview,
  getEditablePreviewTarget,
  type EditablePreviewTarget
} from './useWorkspaceEditing'
import type { PreviewPayload } from '../../../shared/types'

export type FileViewMode = 'preview' | 'code' | 'split' | 'blame'

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

interface ResolveFileViewModeOptions {
  preferredMode: FileViewMode
  canEditPreview: boolean
  canSplitPreview: boolean
  hasEditablePreviewTarget: boolean
  isEditing: boolean
}

export function resolveFileViewMode({
  preferredMode,
  canEditPreview,
  canSplitPreview,
  hasEditablePreviewTarget,
  isEditing
}: ResolveFileViewModeOptions): FileViewMode {
  if (preferredMode === 'split' && !canSplitPreview) {
    return canEditPreview && isEditing ? 'code' : 'preview'
  }

  if (preferredMode === 'blame' && !hasEditablePreviewTarget) {
    return 'preview'
  }

  if (preferredMode === 'code' && (!canEditPreview || !isEditing)) {
    return 'preview'
  }

  return preferredMode
}

export function useFileViewMode({
  preview,
  draftContent,
  isEditing,
  canEditPreview,
  startEditing
}: FileViewModeOptions): FileViewModeControls {
  const [preferredFileViewMode, setPreferredFileViewMode] = useState<FileViewMode>('preview')
  const editablePreviewTarget = getEditablePreviewTarget(preview)
  const canSplitPreview = Boolean(
    canEditPreview &&
    editablePreviewTarget &&
    ['.md', '.markdown', '.mdx'].includes(editablePreviewTarget.extension.toLocaleLowerCase())
  )
  const shouldEditPreferredMode =
    preferredFileViewMode === 'code' || preferredFileViewMode === 'split'
  const effectiveFileViewMode = resolveFileViewMode({
    preferredMode: preferredFileViewMode,
    canEditPreview,
    canSplitPreview,
    hasEditablePreviewTarget: Boolean(editablePreviewTarget),
    isEditing
  })
  const isEditorMounted = Boolean(editablePreviewTarget && isEditing)
  const showsEditor = Boolean(
    editablePreviewTarget &&
    isEditing &&
    (effectiveFileViewMode === 'code' || effectiveFileViewMode === 'split')
  )
  const showsPreview = Boolean(
    preview && effectiveFileViewMode !== 'code' && effectiveFileViewMode !== 'blame'
  )
  const previewForDisplay =
    editablePreviewTarget && isEditing ? applyDraftToPreview(preview, draftContent) : preview
  const fileWorkspaceClassName =
    effectiveFileViewMode === 'split' ? 'file-workspace split' : 'file-workspace'
  const editorPaneClassName =
    effectiveFileViewMode === 'split' ? 'file-editor-pane split' : 'file-editor-pane'

  useEffect(() => {
    if (shouldEditPreferredMode && canEditPreview && !isEditing) {
      startEditing()
    }
  }, [
    canEditPreview,
    editablePreviewTarget?.path,
    isEditing,
    shouldEditPreferredMode,
    startEditing
  ])

  const selectFileViewMode = useCallback(
    (mode: FileViewMode): void => {
      if ((mode === 'code' || mode === 'split') && canEditPreview && !isEditing) {
        startEditing()
      }

      setPreferredFileViewMode(mode)
    },
    [canEditPreview, isEditing, startEditing]
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
