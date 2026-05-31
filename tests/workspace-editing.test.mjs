/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

async function loadWorkspaceEditing() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/hooks/useWorkspaceEditing.ts',
    modules: ['src/renderer/src/hooks/useWorkspaceEditing.ts', 'src/shared/types.ts']
  })
  return { module, tempDir }
}

test('getEditablePreviewTarget derives editable file preview metadata', async () => {
  const { module } = await loadWorkspaceEditing()
  const preview = {
    kind: 'file',
    path: 'docs/guide.md',
    name: 'guide.md',
    extension: '.md',
    previewType: 'markdown',
    editable: true,
    content: '# Guide\n',
    encoding: 'UTF-8',
    size: 8,
    modifiedAt: '2026-05-31T00:00:00.000Z'
  }

  assert.deepEqual(module.getEditablePreviewTarget(preview), {
    path: 'docs/guide.md',
    name: 'guide.md',
    extension: '.md',
    editable: true,
    content: '# Guide\n',
    encoding: 'UTF-8',
    modifiedAt: '2026-05-31T00:00:00.000Z',
    lastChange: undefined
  })
})

test('getEditablePreviewTarget derives editable directory readme metadata', async () => {
  const { module } = await loadWorkspaceEditing()
  const preview = {
    kind: 'directory',
    path: 'docs',
    modifiedAt: '2026-05-31T00:00:00.000Z',
    readme: {
      path: 'docs/index.md',
      name: 'index.md',
      extension: '',
      editable: true,
      content: '# Docs\n',
      encoding: 'UTF-8',
      modifiedAt: '2026-05-31T00:00:01.000Z'
    }
  }

  assert.deepEqual(module.getEditablePreviewTarget(preview), {
    path: 'docs/index.md',
    name: 'index.md',
    extension: '.md',
    editable: true,
    content: '# Docs\n',
    encoding: 'UTF-8',
    modifiedAt: '2026-05-31T00:00:01.000Z',
    lastChange: undefined
  })
})

test('applyDraftToPreview patches file and directory readme content without changing shape', async () => {
  const { module } = await loadWorkspaceEditing()
  const filePreview = {
    kind: 'file',
    path: 'README.md',
    name: 'README.md',
    extension: '.md',
    previewType: 'markdown',
    editable: true,
    content: '# Old\n',
    size: 6,
    modifiedAt: '2026-05-31T00:00:00.000Z'
  }
  const directoryPreview = {
    kind: 'directory',
    path: '',
    modifiedAt: '2026-05-31T00:00:00.000Z',
    readme: {
      path: 'README.md',
      name: 'README.md',
      extension: '.md',
      editable: true,
      content: '# Old\n',
      encoding: 'UTF-8',
      modifiedAt: '2026-05-31T00:00:00.000Z'
    }
  }

  assert.equal(module.applyDraftToPreview(filePreview, '# New\n').content, '# New\n')
  assert.equal(module.applyDraftToPreview(directoryPreview, '# New\n').readme.content, '# New\n')
})
