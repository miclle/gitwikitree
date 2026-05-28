/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import { loadTranspiledModule } from './helpers/transpile-modules.mjs'

const execFileAsync = promisify(execFile)

async function loadRepositoryService() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/main/repository-service.ts',
    prefix: 'gitwikitree-service-test-',
    modules: [
      'src/main/repository-service.ts',
      'src/main/repository-loader.ts',
      'src/main/repository-preview.ts',
      'src/main/repository-worktree.ts',
      'src/main/repository-paths.ts',
      'src/main/repository-tree.ts',
      'src/main/git-service.ts',
      'src/main/preview-detection.ts',
      'src/shared/types.ts'
    ]
  })

  return { service: module, tempDir }
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
