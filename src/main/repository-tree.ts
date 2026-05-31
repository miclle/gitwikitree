import type { TreeNode } from '../shared/types'
import { defaultAppSettings } from '../shared/types'

let directoryIndexNames = normalizeDirectoryIndexNames(defaultAppSettings.homeFileNames)

type DirectoryIndex = {
  name: string
  path: string
}

export type RepositoryTree = {
  tree: TreeNode[]
  index?: DirectoryIndex
}

export function buildTree(files: string[]): TreeNode[] {
  return buildRepositoryTree(files).tree
}

export function normalizeDirectoryIndexNames(names: string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const name of names) {
    const lowerName = name.trim().toLocaleLowerCase()
    if (!lowerName || lowerName.includes('/') || lowerName.includes('\\') || seen.has(lowerName)) {
      continue
    }

    seen.add(lowerName)
    normalized.push(lowerName)
  }

  return normalized.length
    ? normalized
    : defaultAppSettings.homeFileNames.map((name) => name.toLocaleLowerCase())
}

export function configureDirectoryIndexNames(names: string[]): void {
  directoryIndexNames = normalizeDirectoryIndexNames(names)
}

export function buildRepositoryTree(
  files: string[],
  modifiedFiles = new Set<string>(),
  indexNames = directoryIndexNames
): RepositoryTree {
  const tree: TreeNode[] = []
  let index: DirectoryIndex | undefined

  files.forEach((file) => {
    const inserted = insertPath(tree, file, modifiedFiles, indexNames)
    if (inserted) return

    const rootIndex = directoryIndexForPath(file, indexNames)
    if (!rootIndex || file.includes('/') || !shouldPreferIndex(index, rootIndex, indexNames)) return
    index = rootIndex
  })

  return { tree, index }
}

function directoryIndexForPath(
  filePath: string,
  indexNames = directoryIndexNames
): DirectoryIndex | undefined {
  const parts = filePath.split('/').filter(Boolean)
  const name = parts.at(-1)
  if (!name || !indexNames.includes(name.toLowerCase())) return undefined

  return { name, path: filePath }
}

function shouldPreferIndex(
  current: DirectoryIndex | undefined,
  next: DirectoryIndex,
  indexNames = directoryIndexNames
): boolean {
  if (!current) return true

  return (
    indexNames.indexOf(next.name.toLowerCase()) < indexNames.indexOf(current.name.toLowerCase())
  )
}

function insertPath(
  tree: TreeNode[],
  filePath: string,
  modifiedFiles: Set<string>,
  indexNames = directoryIndexNames
): boolean {
  const parts = filePath.split('/').filter(Boolean)
  let siblings = tree
  let currentPath = ''
  let directoryNode: TreeNode | undefined

  parts.forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const type = index === parts.length - 1 ? 'file' : 'directory'

    if (type === 'file') {
      const directoryIndex = directoryIndexForPath(filePath, indexNames)
      if (directoryIndex) {
        if (directoryNode && shouldPreferIndex(directoryNode.index, directoryIndex, indexNames)) {
          directoryNode.index = directoryIndex
        }
        return
      }
    }

    let node = siblings.find((item) => item.name === part)

    if (!node) {
      node = {
        name: part,
        path: currentPath,
        type,
        ...(type === 'file' && modifiedFiles.has(currentPath)
          ? { gitStatus: 'modified' as const }
          : {}),
        ...(type === 'directory' ? { children: [] } : {})
      }
      siblings.push(node)
      siblings.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
    }

    if (node.type === 'directory') {
      directoryNode = node
      siblings = node.children ?? []
    }
  })

  return !directoryIndexForPath(filePath, indexNames)
}

export function getNodeAtPath(tree: TreeNode[], path: string): TreeNode | undefined {
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

export function findDirectoryIndex(children: TreeNode[] = []): TreeNode | undefined {
  return children
    .filter((entry) => entry.type === 'file')
    .sort((a, b) => {
      return (
        directoryIndexNames.indexOf(a.name.toLowerCase()) -
        directoryIndexNames.indexOf(b.name.toLowerCase())
      )
    })
    .find((entry) => directoryIndexNames.includes(entry.name.toLowerCase()))
}
