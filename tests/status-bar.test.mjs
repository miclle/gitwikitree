/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

process.env.TZ = 'Asia/Shanghai'

async function loadStatusBar() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/renderer/src/status-bar.ts',
    prefix: 'gitwikitree-status-bar-test-',
    modules: ['src/renderer/src/status-bar.ts', 'src/shared/types.ts']
  })

  return { module, tempDir }
}

test('getStatusBarFileFacts summarizes text previews with words, lines, size, modified time, and Git author', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    assert.deepEqual(
      module.getStatusBarFileFacts({
        kind: 'file',
        path: 'docs/guide.md',
        name: 'guide.md',
        extension: '.md',
        previewType: 'markdown',
        editable: true,
        content: '# Guide\n\nHello brave new workspace\n',
        encoding: 'UTF-8',
        size: 1234,
        modifiedAt: '2026-05-30T10:15:00.000Z',
        lastChange: {
          authorName: 'Miclle Zheng',
          authorEmail: 'miclle@example.com',
          committedAt: '2026-05-27T06:59:00.000Z',
          shortHash: '60a7b50',
          subject: 'feat(app): add custom titlebar tabs'
        }
      }),
      ['5 words', '3 lines', '1.2 KB', 'UTF-8', 'Miclle Zheng, May 27, 2026, 14:59']
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getStatusBarFileFacts summarizes directories and non-text files without fake word counts', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    assert.deepEqual(
      module.getStatusBarFileFacts({
        kind: 'directory',
        path: 'docs',
        entries: [
          { name: 'guide.md', path: 'docs/guide.md', type: 'file' },
          { name: 'api', path: 'docs/api', type: 'directory' }
        ],
        modifiedAt: '2026-05-30T08:00:00.000Z'
      }),
      ['2 items', 'Modified May 30, 2026, 16:00']
    )

    assert.deepEqual(
      module.getStatusBarFileFacts({
        kind: 'file',
        path: 'assets/logo.png',
        name: 'logo.png',
        extension: '.png',
        previewType: 'image',
        editable: true,
        dataUrl: 'data:image/png;base64,AA==',
        size: 2048,
        modifiedAt: '2026-05-30T08:00:00.000Z'
      }),
      ['2 KB', 'Modified May 30, 2026, 16:00']
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getStatusBarFileFacts includes rendered PDF page count when available', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    assert.deepEqual(
      module.getStatusBarFileFacts(
        {
          kind: 'file',
          path: 'assets/spec.pdf',
          name: 'spec.pdf',
          extension: '.pdf',
          previewType: 'pdf',
          editable: false,
          dataUrl: 'data:application/pdf;base64,AA==',
          size: 4096,
          modifiedAt: '2026-05-30T08:00:00.000Z'
        },
        { pdfPageCount: 25 }
      ),
      ['25 pages', '4 KB', 'Modified May 30, 2026, 16:00']
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getStatusBarFileFacts can summarize facts in Chinese', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    assert.deepEqual(
      module.getStatusBarFileFacts(
        {
          kind: 'file',
          path: 'docs/guide.md',
          name: 'guide.md',
          extension: '.md',
          previewType: 'markdown',
          editable: true,
          content: '# 指南\n\n你好 workspace\n',
          encoding: 'UTF-8',
          size: 512,
          modifiedAt: '2026-05-30T08:00:00.000Z'
        },
        { language: 'zh-CN' }
      ),
      ['3 个词', '3 行', '512 B', 'UTF-8', '修改于 2026年5月30日 16:00']
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getStatusBarEditorFacts summarizes cursor, selection, characters, and indentation', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    assert.deepEqual(
      module.getStatusBarEditorFacts({
        line: 12,
        column: 5,
        selectionCount: 2,
        selectedCharacters: 9,
        characterCount: 128,
        indentStyle: 'space',
        indentSize: 2,
        encoding: 'UTF-8',
        modifiedAt: '2026-05-30T10:15:00.000Z',
        lastChange: {
          authorName: 'Miclle Zheng',
          authorEmail: 'miclle@example.com',
          committedAt: '2026-05-27T06:59:00.000Z',
          shortHash: '60a7b50',
          subject: 'feat(app): add custom titlebar tabs'
        }
      }),
      [
        'Ln 12, Col 5',
        '2 selections (9 chars)',
        '128 chars',
        'Spaces: 2',
        'UTF-8',
        'Miclle Zheng, May 27, 2026, 14:59'
      ]
    )

    assert.deepEqual(
      module.getStatusBarEditorFacts({
        line: 3,
        column: 1,
        selectionCount: 0,
        selectedCharacters: 0,
        characterCount: 42,
        indentStyle: 'tab',
        indentSize: 4,
        encoding: 'UTF-8',
        modifiedAt: '2026-05-30T10:15:00.000Z'
      }),
      ['Ln 3, Col 1', '42 chars', 'Tab Size: 4', 'UTF-8', 'Modified May 30, 2026, 18:15']
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getStatusBarPath points at the rendered directory index file when one is shown', async () => {
  const { module, tempDir } = await loadStatusBar()

  try {
    const repository = {
      name: 'repo',
      path: '/Users/miclle/github/miclle/repo',
      rootPath: '/Users/miclle/github/miclle/repo',
      branch: 'main',
      activeRef: 'main',
      source: 'working-tree',
      editable: true,
      refs: [],
      tree: []
    }

    assert.equal(
      module.getStatusBarPath(repository, {
        kind: 'directory',
        path: 'docs',
        readme: {
          path: 'docs/README.md',
          content: '# Docs\n'
        },
        modifiedAt: '2026-05-30T08:00:00.000Z'
      }),
      '/Users/miclle/github/miclle/repo/docs/README.md'
    )
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
})
