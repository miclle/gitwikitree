import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canMoveTabHistory,
  createFileTab,
  moveActiveTabHistory,
  navigateFileTabs,
  type OpenFileTab
} from '../app-navigation'
import { usePanelResize } from './usePanelResize'
import { useSessionPersistence } from './useSessionPersistence'
import { useTabPopover } from './useTabPopover'
import { fileNameFromPath, getRepositoryLabel, hydrateOpenFileTab, parentPaths } from '../app-utils'
import { resolveRepositoryNavigationTarget } from '../repository-navigation'
import type {
  NavigationTarget,
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  PreviewPayload,
  ProjectSessionState,
  RecentFileState,
  RepositoryPayload,
  RepositorySource,
  SessionState,
  TreeItemOpenPayload,
  TreeNode
} from '../../../shared/types'

const defaultExpanded = new Set([''])

type RepositoryLoadContext = {
  repoPath: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
}

async function loadRepositoryFromContext({
  repoPath,
  rootPath,
  activeRef,
  source
}: RepositoryLoadContext): Promise<RepositoryPayload> {
  return source === 'git-ref' && activeRef
    ? window.api.loadRef(rootPath ?? repoPath, activeRef, rootPath)
    : window.api.loadRepository(repoPath)
}

async function loadRepositoryForProjectSession(
  fallbackRepository: RepositoryPayload,
  session: ProjectSessionState
): Promise<RepositoryPayload> {
  if (session.source !== 'git-ref' || !session.activeRef) return fallbackRepository

  return loadRepositoryFromContext({
    repoPath: session.repositoryPath ?? fallbackRepository.path,
    rootPath: session.rootPath,
    activeRef: session.activeRef,
    source: session.source
  })
}

function resolveHistoryTargets(
  repository: RepositoryPayload,
  history: NavigationTarget[] | undefined
): NavigationTarget[] | undefined {
  return history?.map((target) => {
    return resolveRepositoryNavigationTarget(repository, target.path)?.target ?? target
  })
}

export type RepositoryWorkspace = ReturnType<typeof useRepositoryWorkspace>

export function useRepositoryWorkspace(): {
  repository: RepositoryPayload | undefined
  selectedPath: string
  expandedPaths: Set<string>
  preview: PreviewPayload | undefined
  loading: boolean
  previewLoading: boolean
  error: string | undefined
  isSidebarOpen: boolean
  setIsSidebarOpen: (isOpen: boolean) => void
  openFileTabs: OpenFileTab[]
  activeFileTabId: string | undefined
  sidebarWidth: number
  isResizing: boolean
  startResizing: () => void
  titlebarTabsRef: React.MutableRefObject<HTMLElement | null>
  tabPopover:
    | {
        tab: OpenFileTab
        left: number
        visible: boolean
      }
    | undefined
  tabPopoverStyle: React.CSSProperties | undefined
  showTabPopover: (tab: OpenFileTab, tabElement: HTMLElement) => void
  hideTabPopover: (delayed?: boolean) => void
  handleTitlebarTabsPointerLeave: (event: React.PointerEvent<HTMLElement>) => void
  openRepository: () => Promise<void>
  handleSelect: (node: TreeNode, options?: { openInNewTab?: boolean }) => Promise<void>
  toggleDirectory: (path: string) => void
  showTreeItemContextMenu: (node: TreeNode) => Promise<void>
  showBreadcrumbContextMenu: (path: string) => Promise<void>
  selectFileTab: (tab: OpenFileTab) => Promise<void>
  closeFileTab: (id: string) => void
  navigateActiveTabHistory: (delta: -1 | 1) => Promise<void>
  switchRef: (ref: string) => Promise<void>
  openRepositoryPreview: () => void
  openBreadcrumbPath: (path: string) => void
  selectPreviewPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  pendingMarkdownAnchor: { path: string; hash: string; token: number } | undefined
  clearPendingMarkdownAnchor: (token: number) => void
  showMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  breadcrumbParts: string[]
  repositoryLabel: string
  canNavigateBack: boolean
  canNavigateForward: boolean
} {
  const didRestoreSession = useRef(false)
  const didReceiveOpenIntent = useRef(false)
  const nextTabId = useRef(0)
  const nextAnchorToken = useRef(0)
  const [repository, setRepository] = useState<RepositoryPayload | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded)
  const [preview, setPreview] = useState<PreviewPayload | undefined>()
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openFileTabs, setOpenFileTabs] = useState<OpenFileTab[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [activeFileTabId, setActiveFileTabId] = useState<string | undefined>()
  const [pendingMarkdownAnchor, setPendingMarkdownAnchor] = useState<
    { path: string; hash: string; token: number } | undefined
  >()
  const { sidebarWidth, isResizing, startResizing } = usePanelResize()
  const {
    titlebarTabsRef,
    tabPopover,
    tabPopoverStyle,
    showTabPopover,
    hideTabPopover,
    handleTitlebarTabsPointerLeave
  } = useTabPopover()

  const createNextTabId = useCallback((): string => {
    nextTabId.current += 1
    return `tab-${Date.now().toString(36)}-${nextTabId.current}`
  }, [])

  const loadPreview = useCallback(
    async (path: string, repo = repository): Promise<PreviewPayload | undefined> => {
      if (!repo) return undefined

      setPreviewLoading(true)
      setError(undefined)

      try {
        const nextPreview = await window.api.previewPath(repo.path, path, {
          ref: repo.activeRef,
          source: repo.source,
          rootPath: repo.rootPath
        })
        setPreview(nextPreview)
        return nextPreview
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        return undefined
      } finally {
        setPreviewLoading(false)
      }
    },
    [repository]
  )

  const restoreRepositorySession = useCallback(
    async (nextRepository: RepositoryPayload, session: ProjectSessionState): Promise<void> => {
      const restoredTabs = session.openFileTabs
        .map((tab) => {
          const resolved = resolveRepositoryNavigationTarget(nextRepository, tab.path)
          if (!resolved) return undefined

          return {
            ...tab,
            ...resolved.target,
            history: resolveHistoryTargets(nextRepository, tab.history)
          }
        })
        .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
        .map((tab, index) => hydrateOpenFileTab(tab, index))
      const restoredActiveTab =
        restoredTabs.find((tab) => tab.id === session.activeFileTabId) ?? restoredTabs[0]
      const restoredActiveTabId =
        restoredActiveTab?.id ??
        restoredTabs.find((tab) => tab.path === session.activeFilePath)?.id ??
        restoredTabs[0]?.id
      const restoredActiveFile =
        restoredActiveTab?.type === 'directory' ? undefined : restoredActiveTab?.path
      const selectedPath = restoredActiveTab?.path ?? session.selectedPath ?? ''
      const selectedTarget = resolveRepositoryNavigationTarget(nextRepository, selectedPath)
      const nextSelectedPath = selectedTarget?.target.path ?? ''

      setRepository(nextRepository)
      setExpandedPaths(
        new Set([
          ...(session.expandedPaths.length ? session.expandedPaths : ['']),
          ...parentPaths(nextSelectedPath)
        ])
      )
      setOpenFileTabs(restoredTabs)
      setActiveFilePath(restoredActiveFile)
      setActiveFileTabId(restoredActiveTabId)
      setSelectedPath(nextSelectedPath)
      await loadPreview(nextSelectedPath, nextRepository)
    },
    [loadPreview]
  )

  const openRepository = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(undefined)

    try {
      const nextRepository = await window.api.pickRepository()
      if (!nextRepository) return

      const projectSession = await window.api.getProjectSession(nextRepository.path)
      if (projectSession) {
        await restoreRepositorySession(
          await loadRepositoryForProjectSession(nextRepository, projectSession),
          projectSession
        )
        return
      }

      setRepository(nextRepository)
      setSelectedPath('')
      setExpandedPaths(defaultExpanded)
      setOpenFileTabs([])
      setActiveFilePath(undefined)
      setActiveFileTabId(undefined)
      await loadPreview('', nextRepository)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [loadPreview, restoreRepositorySession])

  const loadRepositoryPath = useCallback(
    async (repoPath: string): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const projectSession = await window.api.getProjectSession(repoPath)
        if (projectSession) {
          const nextRepository = await loadRepositoryFromContext({
            repoPath: projectSession.repositoryPath ?? repoPath,
            rootPath: projectSession.rootPath,
            activeRef: projectSession.activeRef,
            source: projectSession.source
          })
          await restoreRepositorySession(nextRepository, projectSession)
          return
        }

        const nextRepository = await window.api.loadRepository(repoPath)
        const normalizedProjectSession = await window.api.getProjectSession(nextRepository.path)
        if (normalizedProjectSession) {
          await restoreRepositorySession(
            await loadRepositoryForProjectSession(nextRepository, normalizedProjectSession),
            normalizedProjectSession
          )
          return
        }

        setRepository(nextRepository)
        setSelectedPath('')
        setExpandedPaths(defaultExpanded)
        setOpenFileTabs([])
        setActiveFilePath(undefined)
        setActiveFileTabId(undefined)
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview, restoreRepositorySession]
  )

  const loadRepositoryWithSession = useCallback(
    async (session: SessionState): Promise<void> => {
      if (!session.repositoryPath) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await loadRepositoryFromContext({
          repoPath: session.repositoryPath,
          rootPath: session.rootPath,
          activeRef: session.activeRef,
          source: session.source
        })
        await restoreRepositorySession(nextRepository, session)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [restoreRepositorySession]
  )

  const openFilePath = useCallback(
    async (file: RecentFileState): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await loadRepositoryFromContext(file)
        const filePath = file.filePath
        const resolved = resolveRepositoryNavigationTarget(nextRepository, filePath)

        setRepository(nextRepository)
        setExpandedPaths(new Set(['', ...parentPaths(filePath)]))

        if (resolved) {
          const { target } = resolved
          setSelectedPath(target.path)
          setActiveFilePath(target.type === 'directory' ? undefined : target.path)
          const tab = createFileTab(target, createNextTabId())
          setActiveFileTabId(tab.id)
          setOpenFileTabs((current) =>
            repository?.path === nextRepository.path
              ? [...current.filter((item) => item.path !== target.path), tab]
              : [tab]
          )
          await loadPreview(target.path, nextRepository)
        } else {
          setSelectedPath('')
          setActiveFilePath(undefined)
          setActiveFileTabId(undefined)
          await loadPreview('', nextRepository)
          setError(`${fileNameFromPath(filePath)} is no longer available in this repository.`)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [createNextTabId, loadPreview, repository?.path]
  )

  const openTreeItem = useCallback(
    async (item: TreeItemOpenPayload): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await loadRepositoryFromContext(item)
        const resolved = resolveRepositoryNavigationTarget(nextRepository, item.path)

        setRepository(nextRepository)
        setExpandedPaths(new Set(['', ...parentPaths(item.path)]))

        if (!resolved) {
          setSelectedPath('')
          setActiveFilePath(undefined)
          setActiveFileTabId(undefined)
          setOpenFileTabs([])
          await loadPreview('', nextRepository)
          setError(`${fileNameFromPath(item.path)} is no longer available in this repository.`)
          return
        }

        const { target } = resolved
        if (item.anchor) {
          nextAnchorToken.current += 1
          setPendingMarkdownAnchor({
            path: target.path,
            hash: item.anchor,
            token: nextAnchorToken.current
          })
        }
        setSelectedPath(target.path)
        setActiveFilePath(target.type === 'directory' ? undefined : target.path)
        const tab = createFileTab(target, createNextTabId())
        setActiveFileTabId(tab.id)
        setOpenFileTabs([tab])
        await loadPreview(target.path, nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [createNextTabId, loadPreview]
  )

  useEffect(() => {
    const removeOpenPathListener = window.api.onOpenRepositoryPath((repoPath) => {
      didReceiveOpenIntent.current = true
      void loadRepositoryPath(repoPath)
    })
    const removeOpenFileListener = window.api.onOpenFilePath((file) => {
      didReceiveOpenIntent.current = true
      void openFilePath(file)
    })
    const removeOpenTreeItemListener = window.api.onOpenTreeItem((item) => {
      didReceiveOpenIntent.current = true
      void openTreeItem(item)
    })
    const removeOpenRequestListener = window.api.onOpenRepositoryRequest(() => {
      void openRepository()
    })

    return () => {
      removeOpenPathListener()
      removeOpenFileListener()
      removeOpenTreeItemListener()
      removeOpenRequestListener()
    }
  }, [loadRepositoryPath, openFilePath, openRepository, openTreeItem])

  useEffect(() => {
    if (didRestoreSession.current) return
    didRestoreSession.current = true
    if (didReceiveOpenIntent.current) return

    void window.api.getSession().then((session) => {
      if (didReceiveOpenIntent.current || !session.repositoryPath) return
      void loadRepositoryWithSession(session)
    })
  }, [loadRepositoryWithSession])

  useSessionPersistence({
    repository,
    selectedPath,
    activeFilePath,
    activeFileTabId,
    openFileTabs,
    expandedPaths
  })

  const handleSelect = useCallback(
    async (node: TreeNode, options: { openInNewTab?: boolean } = {}): Promise<void> => {
      setSelectedPath(node.path)

      if (node.type === 'directory') {
        setActiveFilePath(undefined)
        const result = navigateFileTabs({
          tabs: openFileTabs,
          activeTabId: activeFileTabId,
          target: { path: node.path, name: node.name, type: 'directory' },
          openInNewTab: Boolean(options.openInNewTab),
          nextTabId: createNextTabId()
        })
        setOpenFileTabs(result.tabs)
        setActiveFileTabId(result.activeTabId)
        if (node.children?.length) {
          setExpandedPaths((current) => {
            if (current.has(node.path)) return current

            const next = new Set(current)
            next.add(node.path)
            return next
          })
        }
      } else {
        setActiveFilePath(node.path)
        const result = navigateFileTabs({
          tabs: openFileTabs,
          activeTabId: activeFileTabId,
          target: { path: node.path, name: node.name, type: 'file' },
          openInNewTab: Boolean(options.openInNewTab),
          nextTabId: createNextTabId()
        })
        setOpenFileTabs(result.tabs)
        setActiveFileTabId(result.activeTabId)
      }

      await loadPreview(node.path)
    },
    [activeFileTabId, createNextTabId, loadPreview, openFileTabs]
  )

  const showTreeItemContextMenu = useCallback(
    async (node: TreeNode): Promise<void> => {
      if (!repository) return

      await window.api.showTreeItemContextMenu({
        repoPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        path: node.path,
        name: node.name,
        type: node.type
      })
    },
    [repository]
  )

  const showBreadcrumbContextMenu = useCallback(
    async (path: string): Promise<void> => {
      if (!repository) return

      const resolved = resolveRepositoryNavigationTarget(repository, path)
      if (!resolved) return

      await window.api.showTreeItemContextMenu({
        repoPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        path: resolved.target.path,
        name: resolved.target.name,
        type: resolved.target.type ?? 'directory'
      })
    },
    [repository]
  )

  const toggleDirectory = useCallback((path: string): void => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  const selectFileTab = useCallback(
    async (tab: OpenFileTab): Promise<void> => {
      setActiveFileTabId(tab.id)
      setActiveFilePath(tab.type === 'directory' ? undefined : tab.path)
      setSelectedPath(tab.path)
      await loadPreview(tab.path)
    },
    [loadPreview]
  )

  const closeFileTab = useCallback(
    (id: string): void => {
      const tabIndex = openFileTabs.findIndex((tab) => tab.id === id)
      const nextTabs = openFileTabs.filter((tab) => tab.id !== id)

      setOpenFileTabs(nextTabs)

      if (activeFileTabId !== id) return

      const nextTab = nextTabs[Math.min(tabIndex, nextTabs.length - 1)]
      if (nextTab) {
        setActiveFileTabId(nextTab.id)
        setActiveFilePath(nextTab.type === 'directory' ? undefined : nextTab.path)
        setSelectedPath(nextTab.path)
        void loadPreview(nextTab.path)
      } else {
        setActiveFileTabId(undefined)
        setActiveFilePath(undefined)
        setSelectedPath('')
        void loadPreview('')
      }
    },
    [activeFileTabId, loadPreview, openFileTabs]
  )

  const closeCurrentTabOrWindow = useCallback((): void => {
    const activeTab = activeFileTabId
      ? openFileTabs.find((tab) => tab.id === activeFileTabId)
      : undefined
    const tabToClose = activeTab ?? openFileTabs.at(-1)

    if (!tabToClose) {
      void window.api.controlWindow('close')
      return
    }

    closeFileTab(tabToClose.id)
  }, [activeFileTabId, closeFileTab, openFileTabs])

  const navigateActiveTabHistory = useCallback(
    async (delta: -1 | 1): Promise<void> => {
      const result = moveActiveTabHistory(openFileTabs, activeFileTabId, delta)
      if (!result.target) return

      setOpenFileTabs(result.tabs)
      setActiveFilePath(result.target.type === 'directory' ? undefined : result.target.path)
      setSelectedPath(result.target.path)
      await loadPreview(result.target.path)
    },
    [activeFileTabId, loadPreview, openFileTabs]
  )

  useEffect(() => {
    return window.api.onCloseCurrentTabOrWindow(closeCurrentTabOrWindow)
  }, [closeCurrentTabOrWindow])

  const switchRef = useCallback(
    async (ref: string): Promise<void> => {
      if (!repository || ref === repository.activeRef) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.loadRef(
          repository.rootPath,
          ref,
          repository.rootPath
        )
        setRepository(nextRepository)
        setSelectedPath('')
        setExpandedPaths(defaultExpanded)
        setOpenFileTabs([])
        setActiveFilePath(undefined)
        setActiveFileTabId(undefined)
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview, repository]
  )

  const openRepositoryPreview = useCallback((): void => {
    if (!repository) return

    const resolved = resolveRepositoryNavigationTarget(repository, '')
    if (!resolved) return

    setSelectedPath(resolved.target.path)
    setActiveFilePath(undefined)
    const result = navigateFileTabs({
      tabs: openFileTabs,
      activeTabId: activeFileTabId,
      target: resolved.target,
      openInNewTab: false,
      nextTabId: createNextTabId()
    })
    setOpenFileTabs(result.tabs)
    setActiveFileTabId(result.activeTabId)
    void loadPreview(resolved.target.path)
  }, [activeFileTabId, createNextTabId, loadPreview, openFileTabs, repository])

  const openBreadcrumbPath = useCallback(
    (path: string): void => {
      if (!repository) return

      const resolved = resolveRepositoryNavigationTarget(repository, path)
      if (resolved?.node) {
        void handleSelect(resolved.node)
        return
      }

      if (!resolved) return

      setSelectedPath(resolved.target.path)
      setActiveFilePath(undefined)
      const result = navigateFileTabs({
        tabs: openFileTabs,
        activeTabId: activeFileTabId,
        target: resolved.target,
        openInNewTab: false,
        nextTabId: createNextTabId()
      })
      setOpenFileTabs(result.tabs)
      setActiveFileTabId(result.activeTabId)
      void loadPreview(resolved.target.path)
    },
    [activeFileTabId, createNextTabId, handleSelect, loadPreview, openFileTabs, repository]
  )

  const selectPreviewPath = useCallback(
    (path: string, openInNewTab = false, hash?: string): boolean => {
      const resolved = repository ? resolveRepositoryNavigationTarget(repository, path) : undefined
      if (resolved?.node) {
        if (hash) {
          nextAnchorToken.current += 1
          setPendingMarkdownAnchor({
            path: resolved.target.path,
            hash,
            token: nextAnchorToken.current
          })
        }
        setExpandedPaths(
          (current) => new Set([...current, '', ...parentPaths(resolved.target.path)])
        )
        void handleSelect(resolved.node, { openInNewTab })
        return true
      }

      if (resolved) {
        if (hash) {
          nextAnchorToken.current += 1
          setPendingMarkdownAnchor({
            path: resolved.target.path,
            hash,
            token: nextAnchorToken.current
          })
        }
        setExpandedPaths(
          (current) => new Set([...current, '', ...parentPaths(resolved.target.path)])
        )
        setSelectedPath(resolved.target.path)
        setActiveFilePath(undefined)
        const result = navigateFileTabs({
          tabs: openFileTabs,
          activeTabId: activeFileTabId,
          target: resolved.target,
          openInNewTab,
          nextTabId: createNextTabId()
        })
        setOpenFileTabs(result.tabs)
        setActiveFileTabId(result.activeTabId)
        void loadPreview(resolved.target.path)
        return true
      }

      setError(`${fileNameFromPath(path)} is no longer available in this repository.`)
      return false
    },
    [activeFileTabId, createNextTabId, handleSelect, loadPreview, openFileTabs, repository]
  )

  const clearPendingMarkdownAnchor = useCallback((token: number): void => {
    setPendingMarkdownAnchor((current) => (current?.token === token ? undefined : current))
  }, [])

  const showMarkdownLinkContextMenu = useCallback(
    async (item: MarkdownLinkContext): Promise<void> => {
      if (item.kind === 'external') {
        await window.api.showMarkdownLinkContextMenu(item)
        return
      }

      if (!repository || item.targetPath === undefined) return

      const resolved = resolveRepositoryNavigationTarget(repository, item.targetPath)
      const target = resolved?.target

      await window.api.showMarkdownLinkContextMenu({
        ...item,
        repoPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        targetName: target?.name ?? fileNameFromPath(item.targetPath),
        targetType: target?.type ?? 'file'
      })
    },
    [repository]
  )

  const openMarkdownLink = useCallback(
    (payload: MarkdownLinkOpenPayload): void => {
      if (payload.targetPath === undefined) return

      selectPreviewPath(payload.targetPath, payload.action === 'open-new-tab', payload.hash)
    },
    [selectPreviewPath]
  )

  useEffect(() => {
    return window.api.onOpenTreeItemInNewTab((path) => {
      selectPreviewPath(path, true)
    })
  }, [selectPreviewPath])

  useEffect(() => {
    return window.api.onOpenMarkdownLink(openMarkdownLink)
  }, [openMarkdownLink])

  return {
    repository,
    selectedPath,
    expandedPaths,
    preview,
    loading,
    previewLoading,
    error,
    isSidebarOpen,
    setIsSidebarOpen,
    openFileTabs,
    activeFileTabId,
    sidebarWidth,
    isResizing,
    startResizing,
    titlebarTabsRef,
    tabPopover,
    tabPopoverStyle,
    showTabPopover,
    hideTabPopover,
    handleTitlebarTabsPointerLeave,
    openRepository,
    handleSelect,
    toggleDirectory,
    showTreeItemContextMenu,
    showBreadcrumbContextMenu,
    selectFileTab,
    closeFileTab,
    navigateActiveTabHistory,
    switchRef,
    openRepositoryPreview,
    openBreadcrumbPath,
    selectPreviewPath,
    pendingMarkdownAnchor,
    clearPendingMarkdownAnchor,
    showMarkdownLinkContextMenu,
    breadcrumbParts: selectedPath ? selectedPath.split('/').filter(Boolean) : [],
    repositoryLabel: repository ? getRepositoryLabel(repository) : '',
    canNavigateBack: canMoveTabHistory(openFileTabs, activeFileTabId, -1),
    canNavigateForward: canMoveTabHistory(openFileTabs, activeFileTabId, 1)
  }
}
