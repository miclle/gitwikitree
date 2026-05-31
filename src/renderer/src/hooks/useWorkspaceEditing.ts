import { useCallback, useState } from 'react'
import { fileNameFromPath } from '../app-utils'
import type { GitLastChange, PreviewPayload, RepositoryPayload } from '../../../shared/types'

export type EditablePreviewTarget = {
  path: string
  name: string
  extension: string
  editable: boolean
  content: string
  encoding?: string
  modifiedAt: string
  lastChange?: GitLastChange
}

function extensionFromPath(path: string): string {
  const name = fileNameFromPath(path)
  const dotIndex = name.lastIndexOf('.')

  return dotIndex > 0 ? name.slice(dotIndex).toLocaleLowerCase() : ''
}

export function getEditablePreviewTarget(
  preview: PreviewPayload | undefined
): EditablePreviewTarget | undefined {
  if (!preview) return undefined

  if (preview.kind === 'file') {
    if (!preview.editable || preview.content === undefined) return undefined

    return {
      path: preview.path,
      name: preview.name,
      extension: preview.extension,
      editable: preview.editable,
      content: preview.content,
      encoding: preview.encoding,
      modifiedAt: preview.modifiedAt,
      lastChange: preview.lastChange
    }
  }

  if (!preview.readme?.editable) return undefined

  return {
    path: preview.readme.path,
    name: preview.readme.name,
    extension: preview.readme.extension || extensionFromPath(preview.readme.path),
    editable: preview.readme.editable,
    content: preview.readme.content,
    encoding: preview.readme.encoding,
    modifiedAt: preview.readme.modifiedAt,
    lastChange: preview.readme.lastChange
  }
}

export function applyDraftToPreview(
  preview: PreviewPayload | undefined,
  draftContent: string
): PreviewPayload | undefined {
  if (!preview) return undefined

  if (preview.kind === 'file') {
    if (preview.content === undefined) return preview

    return {
      ...preview,
      content: draftContent
    }
  }

  if (!preview.readme) return preview

  return {
    ...preview,
    readme: {
      ...preview.readme,
      content: draftContent
    }
  }
}

export function useWorkspaceEditing({
  discardMessage,
  preview,
  repository,
  setError,
  setPreview,
  setRepository
}: {
  discardMessage: string
  preview: PreviewPayload | undefined
  repository: RepositoryPayload | undefined
  setError: (error: string | undefined) => void
  setPreview: (preview: PreviewPayload | undefined) => void
  setRepository: (repository: RepositoryPayload) => void
}): {
  editablePreviewTarget: EditablePreviewTarget | undefined
  isEditing: boolean
  isSaving: boolean
  canEditPreview: boolean
  draftContent: string
  hasUnsavedChanges: boolean
  isEditingTargetPath: (path: string) => boolean
  discardEditingIfAllowed: () => boolean
  startEditing: () => void
  cancelEditing: () => void
  updateDraftContent: (content: string) => void
  saveCurrentFile: () => Promise<void>
} {
  const [editingPath, setEditingPath] = useState<string | undefined>()
  const [draftContent, setDraftContent] = useState('')
  const [draftModifiedAt, setDraftModifiedAt] = useState<string | undefined>()
  const [isSaving, setIsSaving] = useState(false)
  const editablePreviewTarget = getEditablePreviewTarget(preview)
  const isEditing = Boolean(editablePreviewTarget && editingPath === editablePreviewTarget.path)
  const canEditPreview = Boolean(editablePreviewTarget)
  const hasUnsavedChanges = Boolean(
    isEditing && editablePreviewTarget && draftContent !== editablePreviewTarget.content
  )

  const isEditingTargetPath = useCallback(
    (path: string): boolean =>
      path === editingPath ||
      Boolean(isEditing && preview?.kind === 'directory' && path === preview.path),
    [editingPath, isEditing, preview]
  )

  const clearEditing = useCallback((): void => {
    setEditingPath(undefined)
    setDraftContent('')
    setDraftModifiedAt(undefined)
  }, [])

  const confirmDiscardEditing = useCallback((): boolean => {
    if (!hasUnsavedChanges) return true

    return window.confirm(discardMessage)
  }, [discardMessage, hasUnsavedChanges])

  const discardEditingIfAllowed = useCallback((): boolean => {
    if (!confirmDiscardEditing()) return false

    clearEditing()
    return true
  }, [clearEditing, confirmDiscardEditing])

  const startEditing = useCallback((): void => {
    if (!editablePreviewTarget) return

    setEditingPath(editablePreviewTarget.path)
    setDraftContent(editablePreviewTarget.content)
    setDraftModifiedAt(editablePreviewTarget.modifiedAt)
    setError(undefined)
  }, [editablePreviewTarget, setError])

  const cancelEditing = useCallback((): void => {
    if (!discardEditingIfAllowed()) return

    clearEditing()
  }, [clearEditing, discardEditingIfAllowed])

  const updateDraftContent = useCallback((content: string): void => {
    setDraftContent(content)
  }, [])

  const saveCurrentFile = useCallback(async (): Promise<void> => {
    if (!repository || !preview || !editablePreviewTarget || !isEditing || !hasUnsavedChanges) {
      return
    }

    setIsSaving(true)
    setError(undefined)

    try {
      const saveOptions = {
        source: repository.source,
        rootPath: repository.rootPath,
        expectedModifiedAt: draftModifiedAt
      }
      const nextPreview = await window.api.saveFile(
        repository.path,
        editablePreviewTarget.path,
        draftContent,
        saveOptions
      )
      const nextRepository = await window.api.loadRepository(repository.path)
      const refreshedPreview =
        preview.kind === 'directory'
          ? await window.api.previewPath(repository.path, preview.path, {
              source: repository.source,
              rootPath: repository.rootPath
            })
          : nextPreview
      const nextEditableTarget = getEditablePreviewTarget(refreshedPreview)

      setRepository(nextRepository)
      setPreview(refreshedPreview)
      if (nextEditableTarget) {
        setEditingPath(nextEditableTarget.path)
        setDraftContent(nextEditableTarget.content)
        setDraftModifiedAt(nextEditableTarget.modifiedAt)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setIsSaving(false)
    }
  }, [
    draftContent,
    draftModifiedAt,
    editablePreviewTarget,
    hasUnsavedChanges,
    isEditing,
    preview,
    repository,
    setError,
    setPreview,
    setRepository
  ])

  return {
    editablePreviewTarget,
    isEditing,
    isSaving,
    canEditPreview,
    draftContent,
    hasUnsavedChanges,
    isEditingTargetPath,
    discardEditingIfAllowed,
    startEditing,
    cancelEditing,
    updateDraftContent,
    saveCurrentFile
  }
}
