import type { NavigationTarget, RepositoryPayload, TreeNode } from '../../shared/types'

export type ResolvedRepositoryNavigationTarget = {
  target: NavigationTarget
  node?: TreeNode
}

export function findTreeNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node

    if (node.children) {
      const match = findTreeNode(node.children, path)
      if (match) return match
    }
  }

  return undefined
}

function findDirectoryByIndexPath(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.type === 'directory' && node.index?.path === path) return node

    if (node.children) {
      const match = findDirectoryByIndexPath(node.children, path)
      if (match) return match
    }
  }

  return undefined
}

function targetForNode(node: TreeNode): NavigationTarget {
  return { path: node.path, name: node.name, type: node.type }
}

export function resolveRepositoryNavigationTarget(
  repository: Pick<RepositoryPayload, 'name' | 'tree' | 'index'>,
  path: string
): ResolvedRepositoryNavigationTarget | undefined {
  if (!path) {
    return {
      target: { path: '', name: repository.name, type: 'directory' }
    }
  }

  const node = findTreeNode(repository.tree, path)
  if (node) return { node, target: targetForNode(node) }

  if (repository.index?.path === path) {
    return {
      target: { path: '', name: repository.name, type: 'directory' }
    }
  }

  const directory = findDirectoryByIndexPath(repository.tree, path)
  if (directory) return { node: directory, target: targetForNode(directory) }

  return undefined
}
