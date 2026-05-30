/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
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
      'src/main/repository-files.ts',
      'src/main/repository-preview.ts',
      'src/main/repository-search.ts',
      'src/main/repository-worktree.ts',
      'src/main/repository-workspace.ts',
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
  await mkdir(join(repoPath, 'section'), { recursive: true })
  await mkdir(join(repoPath, '.worktrees', 'scratch'), { recursive: true })
  await writeFile(join(repoPath, 'README.md'), '# Root\n\nHello')
  await writeFile(join(repoPath, 'docs', 'index.md'), '# Docs\n\nWelcome')
  await writeFile(join(repoPath, 'docs', 'guide.md'), '# Guide\n\nContent')
  await writeFile(join(repoPath, 'section', '_index.md'), '# Section\n\nOverview')
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

test('loadRepository builds a working tree from local workspace files', async () => {
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
      ['docs', 'section']
    )
    assert.deepEqual(
      repository.tree[0].children.map((node) => node.path),
      ['docs/guide.md']
    )
    assert.deepEqual(repository.tree[1].children, [])
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview includes file and directory modification timestamps for status metadata', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const filePreview = await service.getPreview(repoPath, 'docs/guide.md')
    const directoryPreview = await service.getPreview(repoPath, 'docs')

    assert.equal(filePreview.kind, 'file')
    assert.equal(directoryPreview.kind, 'directory')
    assert.equal(typeof filePreview.modifiedAt, 'string')
    assert.equal(typeof directoryPreview.modifiedAt, 'string')
    assert.ok(!Number.isNaN(Date.parse(filePreview.modifiedAt)))
    assert.ok(!Number.isNaN(Date.parse(directoryPreview.modifiedAt)))
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadRepository builds the workspace tree from local files instead of git visibility', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await mkdir(join(repoPath, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(repoPath, '.gitignore'), 'ignored-local.log\n')
    await writeFile(join(repoPath, 'ignored-local.log'), 'kept in local workspace')
    await writeFile(join(repoPath, 'node_modules', 'pkg', 'index.js'), 'ignored dependency')

    const repository = await service.loadRepository(repoPath)
    const paths = repository.tree.map((node) => node.path)

    assert.ok(paths.includes('ignored-local.log'))
    assert.ok(!paths.includes('.git'))
    assert.ok(!paths.includes('.worktrees'))
    assert.ok(!paths.includes('node_modules'))
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadRepository excludes git metadata files from linked worktrees', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'feature/worktree'], { cwd: repoPath })
    await writeFile(join(repoPath, 'worktree-file.md'), '# Worktree\n')
    await execFileAsync('git', ['add', 'worktree-file.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add worktree file'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })

    const repository = await service.openWorktree(repoPath, 'feature/worktree')
    const paths = repository.tree.map((node) => node.path)

    assert.ok(paths.includes('worktree-file.md'))
    assert.ok(!paths.includes('.git'))
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadRepository keeps the primary worktree root when opening a linked worktree', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'feature/worktree'], { cwd: repoPath })
    await writeFile(join(repoPath, 'worktree-file.md'), '# Worktree\n')
    await execFileAsync('git', ['add', 'worktree-file.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add worktree file'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const worktreePath = join(repoPath, '.worktrees', 'feature-worktree')
    await execFileAsync('git', ['worktree', 'add', worktreePath, 'feature/worktree'], {
      cwd: repoPath
    })
    const realRepoPath = await realpath(repoPath)

    const repository = await service.loadRepository(worktreePath)

    assert.equal(repository.path, worktreePath)
    assert.equal(repository.rootPath, realRepoPath)
    assert.equal(repository.source, 'worktree')
    assert.equal(repository.branch, 'feature/worktree')
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadRepository annotates local refs that already have a worktree', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'wiki'], { cwd: repoPath })
    await writeFile(join(repoPath, 'wiki.md'), '# Wiki\n')
    await execFileAsync('git', ['add', 'wiki.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add wiki'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const worktreePath = join(repoPath, '.worktrees', 'wiki')
    await execFileAsync('git', ['worktree', 'add', worktreePath, 'wiki'], { cwd: repoPath })

    const repository = await service.loadRepository(worktreePath)
    const mainRef = repository.refs.find((ref) => ref.name === 'main')
    const wikiRef = repository.refs.find((ref) => ref.name === 'wiki')
    const realRepoPath = await realpath(repoPath)
    const realWorktreePath = await realpath(worktreePath)

    assert.equal(mainRef?.worktreePath, realRepoPath)
    assert.equal(wikiRef?.worktreePath, realWorktreePath)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('loadRepository ignores prunable worktrees with missing folders', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'stale-worktree'], { cwd: repoPath })
    await writeFile(join(repoPath, 'stale.md'), '# Stale\n')
    await execFileAsync('git', ['add', 'stale.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add stale worktree file'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const staleWorktreePath = join(repoPath, '.worktrees', 'stale-worktree')
    await execFileAsync('git', ['worktree', 'add', staleWorktreePath, 'stale-worktree'], {
      cwd: repoPath
    })
    await rm(staleWorktreePath, { recursive: true, force: true })

    const repository = await service.loadRepository(repoPath)
    const staleRef = repository.refs.find((ref) => ref.name === 'stale-worktree')

    assert.equal(repository.branch, 'main')
    assert.equal(staleRef?.worktreePath, undefined)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('openWorktree reuses an existing worktree when the target branch is already checked out', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'wiki'], { cwd: repoPath })
    await writeFile(join(repoPath, 'wiki.md'), '# Wiki\n')
    await execFileAsync('git', ['add', 'wiki.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add wiki'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const wikiRepository = await service.openWorktree(repoPath, 'wiki')
    const realRepoPath = await realpath(repoPath)

    const repository = await service.openWorktree(wikiRepository.path, 'main')

    assert.equal(repository.path, realRepoPath)
    assert.equal(repository.rootPath, realRepoPath)
    assert.equal(repository.source, 'working-tree')
    assert.equal(repository.branch, 'main')
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('checkoutBranch opens an existing worktree when the target branch is already checked out', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'wiki'], { cwd: repoPath })
    await writeFile(join(repoPath, 'wiki.md'), '# Wiki\n')
    await execFileAsync('git', ['add', 'wiki.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add wiki'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const wikiRepository = await service.openWorktree(repoPath, 'wiki')
    const realRepoPath = await realpath(repoPath)

    const repository = await service.checkoutBranch(wikiRepository.path, 'main')

    assert.equal(repository.path, realRepoPath)
    assert.equal(repository.rootPath, realRepoPath)
    assert.equal(repository.source, 'working-tree')
    assert.equal(repository.branch, 'main')
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getWorkspaceFiles walks directories without unbounded Promise.all fan-out', async () => {
  const source = await readFile(new URL('../src/main/repository-files.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(
    source,
    /Promise\.all/,
    'workspace file discovery should not launch every directory entry concurrently'
  )
})

test('checkoutBranch switches to a local branch and reloads the working tree', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'feature/docs'], { cwd: repoPath })
    await writeFile(join(repoPath, 'feature.md'), '# Feature\n')
    await execFileAsync('git', ['add', 'feature.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add feature docs'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })

    const repository = await service.checkoutBranch(repoPath, 'feature/docs')

    assert.equal(repository.branch, 'feature/docs')
    assert.equal(repository.activeRef, 'feature/docs')
    assert.equal(repository.source, 'working-tree')
    assert.equal(repository.editable, true)
    assert.ok(repository.tree.some((node) => node.path === 'feature.md'))
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('checkoutBranch switches the primary workspace when invoked from a linked worktree', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    await execFileAsync('git', ['switch', '-c', 'feature/docs'], { cwd: repoPath })
    await writeFile(join(repoPath, 'feature.md'), '# Feature\n')
    await execFileAsync('git', ['add', 'feature.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add feature docs'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    await execFileAsync('git', ['switch', '-c', 'wiki'], { cwd: repoPath })
    await writeFile(join(repoPath, 'wiki.md'), '# Wiki\n')
    await execFileAsync('git', ['add', 'wiki.md'], { cwd: repoPath })
    await execFileAsync('git', ['commit', '-m', 'add wiki'], {
      cwd: repoPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.com'
      }
    })
    await execFileAsync('git', ['switch', 'main'], { cwd: repoPath })
    const wikiRepository = await service.openWorktree(repoPath, 'wiki')
    const realRepoPath = await realpath(repoPath)

    const repository = await service.checkoutBranch(wikiRepository.path, 'feature/docs')
    const { stdout: wikiBranch } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: wikiRepository.path
    })

    assert.equal(repository.path, realRepoPath)
    assert.equal(repository.rootPath, realRepoPath)
    assert.equal(repository.source, 'working-tree')
    assert.equal(repository.branch, 'feature/docs')
    assert.equal(wikiBranch.trim(), 'wiki')
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

    const docsPreview = await service.getPreview(repoPath, 'docs')
    assert.equal(docsPreview.kind, 'directory')
    assert.deepEqual(docsPreview.readme, {
      path: 'docs/index.md',
      content: '# Docs\n\nWelcome'
    })

    const sectionPreview = await service.getPreview(repoPath, 'section')
    assert.equal(sectionPreview.kind, 'directory')
    assert.deepEqual(sectionPreview.readme, {
      path: 'section/_index.md',
      content: '# Section\n\nOverview'
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

test('getPreview includes data URLs for markdown image assets', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    await mkdir(join(repoPath, 'assets'), { recursive: true })
    await writeFile(join(repoPath, 'assets', 'diagram.png'), imageBytes)
    await writeFile(join(repoPath, 'docs', 'with-image.md'), '![Diagram](../assets/diagram.png)')

    const preview = await service.getPreview(repoPath, 'docs/with-image.md')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'markdown')
    assert.deepEqual(preview.markdownAssetDataUrls, {
      '../assets/diagram.png': `data:image/png;base64,${imageBytes.toString('base64')}`
    })
    assert.deepEqual(preview.markdownAssetPaths, {
      '../assets/diagram.png': 'assets/diagram.png'
    })
    assert.deepEqual(preview.markdownAssetAbsolutePaths, {
      '../assets/diagram.png': join(repoPath, 'assets', 'diagram.png')
    })
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview includes data URLs for PDF files', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n')
    await writeFile(join(repoPath, 'docs', 'guide.pdf'), pdfBytes)

    const preview = await service.getPreview(repoPath, 'docs/guide.pdf')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'pdf')
    assert.equal(preview.dataUrl, `data:application/pdf;base64,${pdfBytes.toString('base64')}`)
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview reads markdown assets from the local workspace', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    await mkdir(join(repoPath, 'assets'), { recursive: true })
    await writeFile(join(repoPath, 'assets', 'diagram.png'), imageBytes)
    await writeFile(join(repoPath, 'docs', 'local-image.md'), '![Diagram](../assets/diagram.png)')

    const preview = await service.getPreview(repoPath, 'docs/local-image.md')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'markdown')
    assert.deepEqual(preview.markdownAssetDataUrls, {
      '../assets/diagram.png': `data:image/png;base64,${imageBytes.toString('base64')}`
    })
    assert.deepEqual(preview.markdownAssetPaths, {
      '../assets/diagram.png': 'assets/diagram.png'
    })
    assert.deepEqual(preview.markdownAssetAbsolutePaths, {
      '../assets/diagram.png': join(repoPath, 'assets', 'diagram.png')
    })
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview includes data URLs for raw HTML image assets in markdown', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    await mkdir(join(repoPath, 'docs', 'assets'), { recursive: true })
    await writeFile(join(repoPath, 'docs', 'assets', 'diagram.png'), imageBytes)
    await writeFile(
      join(repoPath, 'docs', 'raw-image.md'),
      '<img width="120" alt="Diagram" src="assets/diagram.png" />'
    )

    const preview = await service.getPreview(repoPath, 'docs/raw-image.md')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'markdown')
    assert.deepEqual(preview.markdownAssetDataUrls, {
      'assets/diagram.png': `data:image/png;base64,${imageBytes.toString('base64')}`
    })
    assert.deepEqual(preview.markdownAssetPaths, {
      'assets/diagram.png': 'docs/assets/diagram.png'
    })
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview tolerates exported markdown assets kept beside the source file', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    await mkdir(join(repoPath, 'docs', 'assets'), { recursive: true })
    await writeFile(join(repoPath, 'docs', 'assets', 'diagram.png'), imageBytes)
    await writeFile(
      join(repoPath, 'docs', 'exported-image.md'),
      '<img alt="Diagram" src="../assets/diagram.png" />'
    )

    const preview = await service.getPreview(repoPath, 'docs/exported-image.md')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'markdown')
    assert.deepEqual(preview.markdownAssetDataUrls, {
      '../assets/diagram.png': `data:image/png;base64,${imageBytes.toString('base64')}`
    })
    assert.deepEqual(preview.markdownAssetPaths, {
      '../assets/diagram.png': 'docs/assets/diagram.png'
    })
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})

test('getPreview includes data URLs for markdown images inside tables', async () => {
  const { service, tempDir } = await loadRepositoryService()
  const repoPath = await createRepository()

  try {
    const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
    await mkdir(join(repoPath, 'docs', 'assets'), { recursive: true })
    await writeFile(join(repoPath, 'docs', 'assets', 'diagram.png'), imageBytes)
    await writeFile(
      join(repoPath, 'docs', 'table-image.md'),
      '| Screenshot |\n| - |\n| ![Diagram](assets/diagram.png) |'
    )

    const preview = await service.getPreview(repoPath, 'docs/table-image.md')

    assert.equal(preview.kind, 'file')
    assert.equal(preview.previewType, 'markdown')
    assert.deepEqual(preview.markdownAssetDataUrls, {
      'assets/diagram.png': `data:image/png;base64,${imageBytes.toString('base64')}`
    })
  } finally {
    await rm(repoPath, { recursive: true, force: true })
    await rm(tempDir, { recursive: true, force: true })
  }
})
