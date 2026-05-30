import type { TreeNode } from '../shared/types'

const directoryIndexNames = ['readme.md', 'readme.markdown', 'index.md', '_index.md']

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

export function buildRepositoryTree(
  files: string[],
  modifiedFiles = new Set<string>()
): RepositoryTree {
  const tree: TreeNode[] = []
  let index: DirectoryIndex | undefined

  files.forEach((file) => {
    const inserted = insertPath(tree, file, modifiedFiles)
    if (inserted) return

    const rootIndex = directoryIndexForPath(file)
    if (!rootIndex || file.includes('/') || !shouldPreferIndex(index, rootIndex)) return
    index = rootIndex
  })

  return { tree, index }
}

function directoryIndexForPath(filePath: string): DirectoryIndex | undefined {
  const parts = filePath.split('/').filter(Boolean)
  const name = parts.at(-1)
  if (!name || !directoryIndexNames.includes(name.toLowerCase())) return undefined

  return { name, path: filePath }
}

function shouldPreferIndex(current: DirectoryIndex | undefined, next: DirectoryIndex): boolean {
  if (!current) return true

  return (
    directoryIndexNames.indexOf(next.name.toLowerCase()) <
    directoryIndexNames.indexOf(current.name.toLowerCase())
  )
}

function insertPath(tree: TreeNode[], filePath: string, modifiedFiles: Set<string>): boolean {
  const parts = filePath.split('/').filter(Boolean)
  let siblings = tree
  let currentPath = ''
  let directoryNode: TreeNode | undefined

  parts.forEach((part, index) => {
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const type = index === parts.length - 1 ? 'file' : 'directory'

    if (type === 'file') {
      const directoryIndex = directoryIndexForPath(filePath)
      if (directoryIndex) {
        if (directoryNode && shouldPreferIndex(directoryNode.index, directoryIndex)) {
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

  return !directoryIndexForPath(filePath)
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
  return children.find((entry) => {
    const lowerName = entry.name.toLowerCase()
    return entry.type === 'file' && directoryIndexNames.includes(lowerName)
  })
}
