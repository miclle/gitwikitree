/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import ts from 'typescript'

const execFileAsync = promisify(execFile)

async function loadRepositoryService() {
  const tempDir = await mkdtemp(join(tmpdir(), 'gitwikitree-service-test-'))
  const mainDir = join(tempDir, 'src/main')
  const sharedDir = join(tempDir, 'src/shared')

  await mkdir(mainDir, { recursive: true })
  await mkdir(sharedDir, { recursive: true })

  const files = [
    ['../src/main/repository-service.ts', join(mainDir, 'repository-service.mjs')],
    ['../src/main/preview-detection.ts', join(mainDir, 'preview-detection.mjs')],
    ['../src/shared/types.ts', join(sharedDir, 'types.mjs')]
  ]

  for (const [sourcePath, outputPath] of files) {
    const source = await readFile(new URL(sourcePath, import.meta.url), 'utf8')
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022
      }
    })
    await writeFile(
      outputPath,
      outputText
        .replaceAll("from './preview-detection'", "from './preview-detection.mjs'")
        .replaceAll("from '../shared/types'", "from '../shared/types.mjs")
    )
  }

  const service = await import(`file://${join(mainDir, 'repository-service.mjs')}`)
  return { service, tempDir }
}

async function createRepository() {
  const repoPath = await mkdtemp(join(tmpdir(), 'gitwikitree-repo-test-'))

  await execFileAsync('git', ['init', '-b', 'main'], { cwd: repoPath })
  await mkdir(join(repoPath, 'docs'), { recursive: true })
  await mkdir(join(repoPath, '.worktrees', 'scratch'), { recursive: true })
  await writeFile(join(repoPath, 'README.md'), '# Root\n\nHello')
  await writeFile(join(repoPath, 'docs', 'guide.md'), '# Guide\n\nContent')
  await writeFile(join(repoPath, '.worktrees', 'scratch', 'hidden.md'), 'hidden')
  await execFileAsync('git', ['add', 'README.md'], { cwd: repoPath })
  await execFileAsync('git', ['commit', '-m', 'initial'], {
    cwd: repoPath,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com'
    }
  })

  return repoPath
}

test('loadRepository builds a working tree from tracked and untracked files', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const repository = await service.loadRepository(repoPath)

    assert.equal(repository.name, repoPath.split('/').at(-1))
    assert.equal(repository.branch, 'main')
    assert.equal(repository.source, 'working-tree')
    assert.equal(repository.editable, true)
    assert.deepEqual(
      repository.tree.map((node) => node.path),
      ['docs', 'README.md']
    )
    assert.deepEqual(
      repository.tree[0].children.map((node) => node.path),
      ['docs/guide.md']
    )
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview returns directory readme content and rejects escaping paths', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const rootPreview = await service.getPreview(repoPath)
    assert.equal(rootPreview.kind, 'directory')
    assert.deepEqual(rootPreview.readme, {
      path: 'README.md',
      content: '# Root\n\nHello'
    })

    await assert.rejects(
      () => service.getPreview(repoPath, '../outside.md'),
      /Path is outside the selected repository/
    )
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})
