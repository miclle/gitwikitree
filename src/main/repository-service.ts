import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { basename, extname, join, relative, resolve, sep, isAbsolute } from 'path'
import { promisify } from 'util'
import { detectPreviewType, textPreviewProbeBytes } from './preview-detection'
import type {
  PreviewPayload,
  RepositoryLoadOptions,
  RepositoryPayload,
  TreeNode
} from '../shared/types'

const execFileAsync = promisify(execFile)
const maxTextPreviewBytes = 1024 * 1024

function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

function isPathInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function assertRepositoryPath(repoPath: string): Promise<string> {
  const resolved = resolve(repoPath)
  const stats = await fs.stat(resolved)

  if (!stats.isDirectory()) {
    throw new Error('Selected path is not a directory.')
  }

  await execFileAsync('git', ['-C', resolved, 'rev-parse', '--show-toplevel'])
  return resolved
}

async function getRepositoryRoot(repoPath: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--show-toplevel'])
  return stdout.trim()
}

async function getBranch(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'branch', '--show-current'])
    return stdout.trim() || 'HEAD'
  } catch {
    return 'HEAD'
  }
}

async function getRefs(
  repoPath: string,
  currentBranch: string
): Promise<RepositoryPayload['refs']> {
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'for-each-ref',
    '--format=%(refname:short)%09%(refname)',
    'refs/heads',
    'refs/remotes'
  ])

  const seen = new Set<string>()
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, fullName] = line.split('\t')
      return {
        name,
        type: fullName?.startsWith('refs/remotes/') ? ('remote' as const) : ('local' as const),
        current: name === currentBranch
      }
    })
    .filter((ref) => {
      if (!ref.name || ref.name.endsWith('/HEAD') || seen.has(ref.name)) return false
      seen.add(ref.name)
      return true
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'local' ? -1 : 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
}

async function getGitVisibleFiles(repoPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'ls-files',
    '-co',
    '--exclude-standard'
  ])

  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => Boolean(file) && !file.startsWith('.worktrees/'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

async function getRefFiles(repoPath: string, ref: string): Promise<string[]> {
  await assertValidRef(repoPath, ref)
  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    '-c',
    'core.quotepath=false',
    'ls-tree',
    '-r',
    '--name-only',
    ref
  ])

  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

function insertPath(tree: TreeNode[], filePath: string): void {
  const parts = filePath.split('/').filter(Boolean)
  let siblings = tree
  let currentPath = ''

  parts.forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const type = index === parts.length - 1 ? 'file' : 'directory'
    let node = siblings.find((item) => item.name === part)

    if (!node) {
      node = {
        name: part,
        path: currentPath,
        type,
        ...(type === 'directory' ? { children: [] } : {})
      }
      siblings.push(node)
      siblings.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
    }

    if (node.type === 'directory') {
      siblings = node.children ?? []
    }
  })
}

async function assertValidRef(repoPath: string, ref: string): Promise<void> {
  if (!ref || ref.includes('\0') || ref.startsWith('-')) {
    throw new Error('Invalid git ref.')
  }

  await execFileAsync('git', ['-C', repoPath, 'rev-parse', '--verify', `${ref}^{commit}`])
}

export async function loadRepository(
  repoPath: string,
  options: RepositoryLoadOptions = {}
): Promise<RepositoryPayload> {
  const resolvedPath = await assertRepositoryPath(repoPath)
  const rootPath = options.rootPath
    ? resolve(options.rootPath)
    : await getRepositoryRoot(resolvedPath)
  const source = options.source ?? 'working-tree'
  const currentBranch = await getBranch(resolvedPath)
  const [branch, refs] = await Promise.all([
    Promise.resolve(currentBranch),
    getRefs(resolvedPath, currentBranch)
  ])
  const activeRef = options.ref ?? branch
  const files =
    source === 'git-ref'
      ? await getRefFiles(resolvedPath, activeRef)
      : await getGitVisibleFiles(resolvedPath)
  const tree: TreeNode[] = []

  files.forEach((file) => insertPath(tree, file))

  return {
    name: basename(resolvedPath),
    path: resolvedPath,
    rootPath,
    branch,
    activeRef,
    source,
    editable: source !== 'git-ref',
    refs: refs.map((ref) => ({ ...ref, current: ref.name === activeRef })),
    tree
  }
}

function safeJoin(repoPath: string, relativePath = ''): string {
  const target = resolve(repoPath, relativePath)

  if (!isPathInside(repoPath, target)) {
    throw new Error('Path is outside the selected repository.')
  }

  return target
}

function getNodeAtPath(tree: TreeNode[], path: string): TreeNode | undefined {
  if (!path) return undefined

  const parts = path.split('/').filter(Boolean)
  let siblings = tree
  let node: TreeNode | undefined

  for (const part of parts) {
    node = siblings.find((item) => item.name === part)
    if (!node) return undefined
    siblings = node.children ?? []
  }

  return node
}

function findReadme(children: TreeNode[] = []): TreeNode | undefined {
  return children.find((entry) => {
    const lowerName = entry.name.toLowerCase()
    return entry.type === 'file' && (lowerName === 'readme.md' || lowerName === 'readme.markdown')
  })
}

function mimeForExtension(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.ico':
      return 'image/x-icon'
    default:
      return 'application/octet-stream'
  }
}

function assertSafeGitRelativePath(relativePath: string): void {
  if (
    relativePath.includes('\0') ||
    relativePath.startsWith('/') ||
    relativePath.split('/').includes('..')
  ) {
    throw new Error('Invalid file path.')
  }
}

async function readRefFile(repoPath: string, ref: string, relativePath: string): Promise<Buffer> {
  assertSafeGitRelativePath(relativePath)

  await assertValidRef(repoPath, ref)
  const { stdout } = await execFileAsync(
    'git',
    ['-C', repoPath, 'show', `${ref}:${relativePath}`],
    {
      encoding: 'buffer',
      maxBuffer: 20 * 1024 * 1024
    }
  )

  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout)
}

async function getRefFileSize(
  repoPath: string,
  ref: string,
  relativePath: string
): Promise<number> {
  assertSafeGitRelativePath(relativePath)

  const { stdout } = await execFileAsync('git', [
    '-C',
    repoPath,
    'cat-file',
    '-s',
    `${ref}:${relativePath}`
  ])
  return Number(stdout.trim()) || 0
}

async function readFileSample(path: string, bytes: number): Promise<Buffer> {
  const file = await fs.open(path, 'r')

  try {
    const buffer = Buffer.alloc(bytes)
    const { bytesRead } = await file.read(buffer, 0, bytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await file.close()
  }
}

export async function getPreview(
  repoPath: string,
  relativePath = '',
  options: RepositoryLoadOptions = {}
): Promise<PreviewPayload> {
  const repository = await loadRepository(repoPath, options)
  const node = relativePath ? getNodeAtPath(repository.tree, relativePath) : undefined
  const target = safeJoin(repository.path, relativePath)
  const isRefSource = repository.source === 'git-ref'
  const stats = isRefSource ? undefined : await fs.stat(target)

  if ((isRefSource && (!relativePath || node?.type === 'directory')) || stats?.isDirectory()) {
    const children = relativePath ? (node?.children ?? []) : repository.tree
    const readme = findReadme(children)

    if (readme) {
      const content = isRefSource
        ? (await readRefFile(repository.path, repository.activeRef, readme.path)).toString('utf8')
        : await fs.readFile(safeJoin(repository.path, readme.path), 'utf8')
      return {
        kind: 'directory',
        path: toPosixPath(relativePath),
        readme: {
          path: readme.path,
          content
        }
      }
    }

    return {
      kind: 'directory',
      path: toPosixPath(relativePath),
      entries: children.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type
      }))
    }
  }

  const size = isRefSource
    ? await getRefFileSize(repository.path, repository.activeRef, relativePath)
    : (stats?.size ?? 0)
  const extension = extname(target).toLowerCase()
  let previewBuffer: Buffer | undefined
  let previewType = detectPreviewType(extension)

  if (previewType === 'unsupported' && size <= maxTextPreviewBytes) {
    const sample = isRefSource
      ? (previewBuffer = await readRefFile(
          repository.path,
          repository.activeRef,
          relativePath
        )).subarray(0, textPreviewProbeBytes)
      : await readFileSample(target, Math.min(size, textPreviewProbeBytes))

    previewType = detectPreviewType(extension, sample)
  }

  const payload = {
    kind: 'file' as const,
    path: toPosixPath(relativePath),
    name: basename(target),
    extension,
    previewType,
    editable: repository.editable,
    size
  }

  if (previewType === 'image') {
    const buffer = isRefSource
      ? await readRefFile(repository.path, repository.activeRef, relativePath)
      : await fs.readFile(target)
    return {
      ...payload,
      dataUrl: `data:${mimeForExtension(extension)};base64,${buffer.toString('base64')}`
    }
  }

  if (previewType === 'svg') {
    return {
      ...payload,
      content: isRefSource
        ? (await readRefFile(repository.path, repository.activeRef, relativePath)).toString('utf8')
        : await fs.readFile(target, 'utf8')
    }
  }

  if (previewType !== 'unsupported' && size <= maxTextPreviewBytes) {
    return {
      ...payload,
      content: isRefSource
        ? (
            previewBuffer ??
            (await readRefFile(repository.path, repository.activeRef, relativePath))
          ).toString('utf8')
        : await fs.readFile(target, 'utf8')
    }
  }

  return payload
}

function slugifyRef(ref: string): string {
  return ref
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/remotes\//, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function openWorktree(repoPath: string, ref: string): Promise<RepositoryPayload> {
  const rootPath = await assertRepositoryPath(repoPath)
  const currentBranch = await getBranch(rootPath)

  if (ref === currentBranch) {
    return loadRepository(rootPath)
  }

  await assertValidRef(rootPath, ref)
  const worktreesDir = join(rootPath, '.worktrees')
  const worktreePath = join(worktreesDir, slugifyRef(ref) || 'branch')

  try {
    const stats = await fs.stat(worktreePath)
    if (stats.isDirectory()) {
      return loadRepository(worktreePath, { source: 'worktree', rootPath })
    }
  } catch {
    await fs.mkdir(worktreesDir, { recursive: true })
  }

  const refs = await getRefs(rootPath, currentBranch)
  const localBranches = new Set(
    refs.filter((item) => item.type === 'local').map((item) => item.name)
  )
  const remotePrefix = ref.includes('/') ? ref.split('/')[0] : ''
  const remoteTail = remotePrefix ? ref.slice(remotePrefix.length + 1) : ref

  if (remoteTail === currentBranch) {
    return loadRepository(rootPath)
  }

  if (localBranches.has(ref)) {
    await execFileAsync('git', ['-C', rootPath, 'worktree', 'add', worktreePath, ref])
  } else if (remotePrefix && !localBranches.has(remoteTail)) {
    await execFileAsync('git', [
      '-C',
      rootPath,
      'worktree',
      'add',
      '-b',
      remoteTail,
      worktreePath,
      ref
    ])
  } else {
    await execFileAsync('git', ['-C', rootPath, 'worktree', 'add', worktreePath, remoteTail])
  }

  return loadRepository(worktreePath, { source: 'worktree', rootPath })
}

export async function saveFile(
  repoPath: string,
  relativePath: string,
  content: string
): Promise<PreviewPayload> {
  const rootPath = await assertRepositoryPath(repoPath)
  const target = safeJoin(rootPath, relativePath)

  await fs.mkdir(resolve(target, '..'), { recursive: true })
  await fs.writeFile(target, content, 'utf8')
  return getPreview(rootPath, relativePath, { source: 'working-tree' })
}
