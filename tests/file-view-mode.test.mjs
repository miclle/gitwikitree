/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadFileViewMode() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/hooks/useFileViewMode.ts',
    prefix: 'gitwikitree-file-view-mode-test-',
    modules: [
      'src/renderer/src/hooks/useFileViewMode.ts',
      'src/renderer/src/hooks/useWorkspaceEditing.ts',
      'src/shared/types.ts'
    ]
  })

  return { module, tempDir }
}

test('resolveFileViewMode keeps the selected mode across editable files', async () => {
  const { module, tempDir } = await loadFileViewMode()

  try {
    assert.equal(
      module.resolveFileViewMode({
        preferredMode: 'code',
        canEditPreview: true,
        canSplitPreview: false,
        hasEditablePreviewTarget: true,
        isEditing: true
      }),
      'code'
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('resolveFileViewMode degrades split when the next file cannot render split view', async () => {
  const { module, tempDir } = await loadFileViewMode()

  try {
    assert.equal(
      module.resolveFileViewMode({
        preferredMode: 'split',
        canEditPreview: true,
        canSplitPreview: false,
        hasEditablePreviewTarget: true,
        isEditing: true
      }),
      'code'
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('resolveFileViewMode returns preview when the preferred mode cannot be used', async () => {
  const { module, tempDir } = await loadFileViewMode()

  try {
    assert.equal(
      module.resolveFileViewMode({
        preferredMode: 'code',
        canEditPreview: false,
        canSplitPreview: false,
        hasEditablePreviewTarget: false,
        isEditing: false
      }),
      'preview'
    )

    assert.equal(
      module.resolveFileViewMode({
        preferredMode: 'blame',
        canEditPreview: false,
        canSplitPreview: false,
        hasEditablePreviewTarget: false,
        isEditing: false
      }),
      'preview'
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
