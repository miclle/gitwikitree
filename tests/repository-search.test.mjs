/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

test('searchRepository does not fail when git refs include oversized files', async () => {
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

test('searchRepository uses one git grep call for git ref content searches', async () => {
  const source = await readFile(
    new URL('../src/main/repository-search.ts', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /'grep'[\s\S]*spawn\('git', args/,
    'git-ref content search should use one streaming git grep process instead of per-file git show calls'
  )
  assert.doesNotMatch(
    source,
    /readRefFile|getRefFileSize/,
    'git-ref content search should not spawn per-file read or size commands'
  )
})

test('searchRepository limits git ref grep output without buffering every match', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    await mkdir(join(repoPath, 'many'), { recursive: true })
    const longLine = `${'x'.repeat(120 * 1024)} common-token\n`
    await Promise.all(
      Array.from({ length: 105 }, (_, index) =>
        writeFile(join(repoPath, 'many', `${String(index).padStart(3, '0')}.txt`), longLine)
      )
    )
    await execFileAsync('git', ['add', 'many'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add many long matches'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })

    const results = await search.searchRepository(repoPath, 'common-token', {
      ref: 'main',
      source: 'git-ref'
    })

    assert.equal(results.length, 100)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository keeps git ref snippets centered on long-line matches', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    await writeFile(join(repoPath, 'long-line.txt'), `${'a'.repeat(220)} rare-token after prefix\n`)
    await execFileAsync('git', ['add', 'long-line.txt'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add long line'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })

    const results = await search.searchRepository(repoPath, 'rare-token', {
      ref: 'main',
      source: 'git-ref'
    })

    assert.equal(results[0].path, 'long-line.txt')
    assert.match(results[0].snippet, /rare-token/)
    assert.match(results[0].snippet, /^\.\.\./)
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
