import { promises as fs } from 'fs'
import { basename, extname, resolve } from 'path'
import { detectPreviewType, textPreviewProbeBytes } from './preview-detection'
import { assertRepositoryPath, getRefFileSize, readRefFile } from './git-service'
import { loadRepository } from './repository-loader'
import { findReadme, getNodeAtPath } from './repository-tree'
import { safeJoin, toPosixPath } from './repository-paths'
import type { PreviewPayload, RepositoryLoadOptions } from '../shared/types'

const maxTextPreviewBytes = 1024 * 1024

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
        readme: { path: readme.path, content }
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
