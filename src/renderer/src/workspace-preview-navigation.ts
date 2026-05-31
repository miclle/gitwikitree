import type { OpenFileTab } from './app-navigation'
import { resolveRepositoryNavigationTarget } from './repository-navigation'
import { parentPaths } from './workspace-paths'
import {
  createWorkspaceNavigationPatch,
  type WorkspaceNavigationPatch
} from './workspace-navigation'
import type { RepositoryPayload, TreeNode } from '../../shared/types'

type CreatePreviewPathNavigationInput = {
  repository: RepositoryPayload
  path: string
  openInNewTab: boolean
  activeFileTabId?: string
  openFileTabs: OpenFileTab[]
  nextTabId: string
  expandAncestors: boolean
}

type PreviewPathNavigationBase = {
  expandedPaths?: string[]
}

export type PreviewPathNavigation =
  | (PreviewPathNavigationBase & {
      kind: 'node'
      node: TreeNode
    })
  | (PreviewPathNavigationBase & {
      kind: 'patch'
      patch: WorkspaceNavigationPatch
      previewPath: string
    })
  | {
      kind: 'missing'
    }

function expandedPathsForTarget(path: string, expandAncestors: boolean): string[] | undefined {
  return expandAncestors ? ['', ...parentPaths(path)] : undefined
}

export function createPreviewPathNavigation({
  repository,
  path,
  openInNewTab,
  activeFileTabId,
  openFileTabs,
  nextTabId,
  expandAncestors
}: CreatePreviewPathNavigationInput): PreviewPathNavigation {
  const resolved = resolveRepositoryNavigationTarget(repository, path)
  if (!resolved) return { kind: 'missing' }

  const expandedPaths = expandedPathsForTarget(resolved.target.path, expandAncestors)
  if (resolved.node) {
    return {
      kind: 'node',
      node: resolved.node,
      ...(expandedPaths ? { expandedPaths } : {})
    }
  }

  return {
    kind: 'patch',
    patch: createWorkspaceNavigationPatch({
      openFileTabs,
      activeFileTabId,
      target: resolved.target,
      openInNewTab,
      nextTabId
    }),
    previewPath: resolved.target.path,
    ...(expandedPaths ? { expandedPaths } : {})
  }
}
