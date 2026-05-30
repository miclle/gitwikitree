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
      'src/main/repository-files.ts',
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

test('searchRepository searches local working tree files only', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    const results = await search.searchRepository(repoPath, 'needle')

    assert.deepEqual(
      results.map((result) => [result.path, result.matchType]),
      [['docs/alpha-guide.md', 'content']]
    )
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository does not shell out to git for content search', async () => {
  const source = await readFile(
    new URL('../src/main/repository-search.ts', import.meta.url),
    'utf8'
  )

  assert.doesNotMatch(
    source,
    /spawn\('git'|git grep|searchRefContent|parseGitGrepRecord/,
    'workspace content search should stay on local filesystem reads'
  )
})

test('searchRepository limits local content search results', async () => {
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
    const results = await search.searchRepository(repoPath, 'common-token')

    assert.equal(results.length, 100)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository keeps local snippets centered on long-line matches', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    await writeFile(join(repoPath, 'long-line.txt'), `${'a'.repeat(220)} rare-token after prefix\n`)

    const results = await search.searchRepository(repoPath, 'rare-token')

    assert.equal(results[0].path, 'long-line.txt')
    assert.match(results[0].snippet, /rare-token/)
    assert.match(results[0].snippet, /^\.\.\./)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository builds snippets from the line matching all query terms', async () => {
  const { search, tempDir } = await loadRepositorySearch()
  const repoPath = await createRepository()

  try {
    await writeFile(
      join(repoPath, 'multi-term.md'),
      '# Notes\n\nAlpha appears with useful context before the Beta marker.\n'
    )

    const results = await search.searchRepository(repoPath, 'alpha beta')

    assert.equal(results[0].path, 'multi-term.md')
    assert.equal(results[0].lineNumber, 3)
    assert.match(results[0].snippet, /Alpha/)
    assert.match(results[0].snippet, /Beta/)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('searchRepository caches searchable file content by file metadata', async () => {
  const source = await readFile(
    new URL('../src/main/repository-search.ts', import.meta.url),
    'utf8'
  )

  assert.match(
    source,
    /searchContentCache/,
    'search should keep a workspace-local cache for reusable searchable file content'
  )
  assert.match(
    source,
    /mtimeMs[\s\S]*size|size[\s\S]*mtimeMs/,
    'cached file content should be keyed by mtime and size so changed files are refreshed'
  )
  assert.match(
    source,
    /maxSearchCacheWorkspaces/,
    'workspace caches should be capped so switching repositories does not leak memory'
  )
  assert.match(
    source,
    /maxSearchCacheEntriesPerWorkspace/,
    'per-workspace file content caches should be capped for large repositories'
  )
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
