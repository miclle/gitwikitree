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

async function loadRepositorySearch() {
  const { module, tempDir } = await loadTranspiledModule({
    entry: 'src/main/repository-search.ts',
    prefix: 'gitwikitree-search-test-',
    modules: [
      'src/main/repository-search.ts',
      'src/main/repository-loader.ts',
      'src/main/repository-paths.ts',
      'src/main/repository-tree.ts',
      'src/main/git-service.ts',
      'src/main/preview-detection.ts',
      'src/shared/types.ts'
    ]
  })

  return { search: module, tempDir }
}

async function createRepository() {
  const repoPath = await mkdtemp(join(tmpdir(), 'gitwikitree-search-repo-test-'))

  await execFileAsync('git', ['init', '-b', 'main'], { cwd: repoPath })
  await mkdir(join(repoPath, 'docs'), { recursive: true })
  await writeFile(join(repoPath, 'README.md'), '# Project\n\nWelcome to Alpha notes.\n')
  await writeFile(join(repoPath, 'docs', 'alpha-guide.md'), '# Guide\n\nNeedle lives here.\n')
  await writeFile(join(repoPath, 'docs', 'beta.md'), '# Beta\n\nNothing special.\n')
  await writeFile(join(repoPath, 'image.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]))
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

test('searchRepository returns ranked path and content matches for the working tree', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    const results = await search.searchRepository(repoPath, 'alpha', { source: 'working-tree' })

    assert.deepEqual(
      results.map((result) => [result.path, result.matchType]),
      [
        ['docs/alpha-guide.md', 'path'],
        ['README.md', 'content']
      ]
    )
    assert.equal(results[0].type, 'file')
    assert.equal(results[1].lineNumber, 3)
    assert.match(results[1].snippet, /Welcome to Alpha notes/)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository searches git refs without including untracked files', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    const results = await search.searchRepository(repoPath, 'needle', {
      ref: 'main',
      source: 'git-ref'
    })

    assert.deepEqual(results, [])
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository skips oversized git ref files before reading content', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    await writeFile(join(repoPath, 'large.txt'), Buffer.alloc(21 * 1024 * 1024, 'x'))
    await execFileAsync('git', ['add', 'large.txt'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add large file'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })

    assert.deepEqual(
      await search.searchRepository(repoPath, 'missing-token', {
        ref: 'main',
        source: 'git-ref'
      }),
      []
    )
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository rejects escaped roots and empty queries', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    assert.deepEqual(await search.searchRepository(repoPath, '   '), [])
    await assert.rejects(
      () => search.searchRepository(join(repoPath, '..'), 'alpha'),
      /not a git repository/
    )
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})
