import { useCallback, useEffect, useRef, useState } from 'react'
import { canMoveTabHistory, type OpenFileTab } from '../app-navigation'
import { usePanelResize } from './usePanelResize'
import { useHomeFileDirectoryPreviewReload } from './useHomeFileDirectoryPreviewReload'
import { usePendingMarkdownAnchor } from './usePendingMarkdownAnchor'
import { useRepositoryLaunchIntents } from './useRepositoryLaunchIntents'
import { useRepositoryPreviewLoader } from './useRepositoryPreviewLoader'
import { useSessionPersistence } from './useSessionPersistence'
import { useTabPopover } from './useTabPopover'
import { useWorkspaceEditing } from './useWorkspaceEditing'
import { useWorkspaceSettings } from './useWorkspaceSettings'
import { fileNameFromPath, getRepositoryLabel, hydrateOpenFileTab, parentPaths } from '../app-utils'
import { resolveRepositoryNavigationTarget } from '../repository-navigation'
import {
  createCloseFileTabPatch,
  createHistoryNavigationPatch,
  createResetNavigationPatch,
  createSingleFileTabPatch,
  createWorkspaceNavigationPatch,
  mergeOpenedFileTab,
  type WorkspaceNavigationPatch
} from '../workspace-navigation'
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
  TreeNode,
  AppSettings
} from '../../../shared/types'

const defaultExpanded = new Set([''])

type RepositoryLoadContext = {
  repoPath: string
  rootPath?: string
  activeRef?: string
  source?: RepositorySource
}

async function loadRepositoryFromContext({
  repoPath
}: RepositoryLoadContext): Promise<RepositoryPayload> {
  return window.api.loadRepository(repoPath)
}

async function loadRepositoryForProjectSession(
  fallbackRepository: RepositoryPayload,
  session: ProjectSessionState
): Promise<RepositoryPayload> {
  if (session.repositoryPath === fallbackRepository.path) return fallbackRepository

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

type RepositoryState = {
  repository: RepositoryPayload | undefined
  selectedPath: string
  expandedPaths: Set<string>
  loading: boolean
  error: string | undefined
  breadcrumbParts: string[]
  repositoryLabel: string
}

type PreviewState = {
  preview: PreviewPayload | undefined
  previewLoading: boolean
  pendingMarkdownAnchor: { path: string; hash: string; token: number } | undefined
  clearPendingMarkdownAnchor: (token: number) => void
  showMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
}

type EditingState = {
  isEditing: boolean
  isSaving: boolean
  canEditPreview: boolean
  draftContent: string
  hasUnsavedChanges: boolean
  startEditing: () => void
  cancelEditing: () => void
  updateDraftContent: (content: string) => void
  saveCurrentFile: () => Promise<void>
}

type LayoutState = {
  isSidebarOpen: boolean
  setIsSidebarOpen: (isOpen: boolean) => void
  sidebarWidth: number
  isResizing: boolean
  startResizing: () => void
}

type TabState = {
  openFileTabs: OpenFileTab[]
  activeFileTabId: string | undefined
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
  selectFileTab: (tab: OpenFileTab) => Promise<void>
  closeFileTab: (id: string) => void
  canNavigateBack: boolean
  canNavigateForward: boolean
}

type NavigationActions = {
  openRepository: () => Promise<void>
  handleSelect: (node: TreeNode, options?: { openInNewTab?: boolean }) => Promise<void>
  toggleDirectory: (path: string) => void
  showTreeItemContextMenu: (node: TreeNode) => Promise<void>
  showBreadcrumbContextMenu: (path: string) => Promise<void>
  navigateActiveTabHistory: (delta: -1 | 1) => Promise<void>
  checkoutBranch: (branch: string) => Promise<void>
  openBranchWorktree: (ref: string) => Promise<void>
  openRepositoryPreview: () => void
  openBreadcrumbPath: (path: string) => void
  selectPreviewPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
}

type SettingsState = {
  settings: AppSettings
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>
}

export type RepositoryWorkspace = {
  repositoryState: RepositoryState
  previewState: PreviewState
  editingState: EditingState
  layoutState: LayoutState
  tabState: TabState
  navigationActions: NavigationActions
  settingsState: SettingsState
}

export function useRepositoryWorkspace(): RepositoryWorkspace {
  const nextTabId = useRef(0)
  const [repository, setRepository] = useState<RepositoryPayload | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded)
  const [loading, setLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openFileTabs, setOpenFileTabs] = useState<OpenFileTab[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [activeFileTabId, setActiveFileTabId] = useState<string | undefined>()
  const { pendingMarkdownAnchor, queuePendingMarkdownAnchor, clearPendingMarkdownAnchor } =
    usePendingMarkdownAnchor()
  const { sidebarWidth, setSidebarWidth, isResizing, startResizing } = usePanelResize()
  const {
    titlebarTabsRef,
    tabPopover,
    tabPopoverStyle,
    showTabPopover,
    hideTabPopover,
    handleTitlebarTabsPointerLeave
  } = useTabPopover()
  const { preview, setPreview, previewLoading, error, setError, loadPreview } =
    useRepositoryPreviewLoader(repository)

  const { scheduleHomeFileDirectoryPreviewReload } = useHomeFileDirectoryPreviewReload({
    preview,
    selectedPath,
    loadPreview
  })

  const { settings, isSettingsOpen, openSettings, closeSettings, saveSettings, t } =
    useWorkspaceSettings({
      onHomeFileNamesChange: scheduleHomeFileDirectoryPreviewReload
    })

  const {
    isEditing,
    isSaving,
    canEditPreview,
    draftContent,
    hasUnsavedChanges,
    isEditingTargetPath,
    discardEditingIfAllowed,
    startEditing,
    cancelEditing,
    updateDraftContent,
    saveCurrentFile
  } = useWorkspaceEditing({
    discardMessage: t('app.discardUnsaved'),
    preview,
    repository,
    setError,
    setPreview,
    setRepository
  })

  const applyNavigationPatch = useCallback((patch: WorkspaceNavigationPatch): void => {
    setSelectedPath(patch.selectedPath)
    setActiveFilePath(patch.activeFilePath)
    setActiveFileTabId(patch.activeFileTabId)
    setOpenFileTabs(patch.openFileTabs)
  }, [])

  const createNextTabId = useCallback((): string => {
    nextTabId.current += 1
    return `tab-${Date.now().toString(36)}-${nextTabId.current}`
  }, [])

  const resetRepositoryLayout = useCallback((): void => {
    setSidebarWidth(250)
    setIsSidebarOpen(true)
  }, [setSidebarWidth])

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
      if (session.sidebarWidth) setSidebarWidth(session.sidebarWidth)
      if (typeof session.isSidebarOpen === 'boolean') {
        setIsSidebarOpen(session.isSidebarOpen)
      }
      await loadPreview(nextSelectedPath, nextRepository)
    },
    [loadPreview, setSidebarWidth]
  )

  const openRepository = useCallback(async (): Promise<void> => {
    if (!discardEditingIfAllowed()) return

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
      resetRepositoryLayout()
      setExpandedPaths(defaultExpanded)
      applyNavigationPatch(createResetNavigationPatch())
      await loadPreview('', nextRepository)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [
    applyNavigationPatch,
    discardEditingIfAllowed,
    loadPreview,
    resetRepositoryLayout,
    restoreRepositorySession,
    setError
  ])

  const loadRepositoryPath = useCallback(
    async (repoPath: string): Promise<void> => {
      if (!discardEditingIfAllowed()) return

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
        resetRepositoryLayout()
        setExpandedPaths(defaultExpanded)
        applyNavigationPatch(createResetNavigationPatch())
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [
      applyNavigationPatch,
      discardEditingIfAllowed,
      loadPreview,
      resetRepositoryLayout,
      restoreRepositorySession,
      setError
    ]
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
    [restoreRepositorySession, setError]
  )

  const openFilePath = useCallback(
    async (file: RecentFileState): Promise<void> => {
      if (!discardEditingIfAllowed()) return

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
          const patch = createSingleFileTabPatch(target, createNextTabId())
          setSelectedPath(patch.selectedPath)
          setActiveFilePath(patch.activeFilePath)
          setActiveFileTabId(patch.activeFileTabId)
          setOpenFileTabs((current) =>
            repository?.path === nextRepository.path
              ? mergeOpenedFileTab(current, patch.openFileTabs[0])
              : patch.openFileTabs
          )
          await loadPreview(target.path, nextRepository)
        } else {
          const patch = createResetNavigationPatch()
          setSelectedPath(patch.selectedPath)
          setActiveFilePath(patch.activeFilePath)
          setActiveFileTabId(patch.activeFileTabId)
          if (repository?.path !== nextRepository.path) setOpenFileTabs(patch.openFileTabs)
          await loadPreview('', nextRepository)
          setError(`${fileNameFromPath(filePath)} is no longer available in this repository.`)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [createNextTabId, discardEditingIfAllowed, loadPreview, repository, setError]
  )

  const openTreeItem = useCallback(
    async (item: TreeItemOpenPayload): Promise<void> => {
      if (!discardEditingIfAllowed()) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await loadRepositoryFromContext(item)
        const resolved = resolveRepositoryNavigationTarget(nextRepository, item.path)

        setRepository(nextRepository)
        setExpandedPaths(new Set(['', ...parentPaths(item.path)]))

        if (!resolved) {
          applyNavigationPatch(createResetNavigationPatch())
          await loadPreview('', nextRepository)
          setError(`${fileNameFromPath(item.path)} is no longer available in this repository.`)
          return
        }

        const { target } = resolved
        if (item.anchor) {
          queuePendingMarkdownAnchor(target.path, item.anchor)
        }
        applyNavigationPatch(createSingleFileTabPatch(target, createNextTabId()))
        await loadPreview(target.path, nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [
      applyNavigationPatch,
      createNextTabId,
      discardEditingIfAllowed,
      loadPreview,
      queuePendingMarkdownAnchor,
      setError
    ]
  )

  useRepositoryLaunchIntents({
    loadRepositoryPath,
    openFilePath,
    openTreeItem,
    openRepository,
    loadRepositoryWithSession
  })

  useSessionPersistence({
    repository,
    selectedPath,
    activeFilePath,
    activeFileTabId,
    openFileTabs,
    expandedPaths,
    sidebarWidth,
    isSidebarOpen
  })

  const handleSelect = useCallback(
    async (node: TreeNode, options: { openInNewTab?: boolean } = {}): Promise<void> => {
      if (!isEditingTargetPath(node.path) && !discardEditingIfAllowed()) return

      const target = { path: node.path, name: node.name, type: node.type }
      applyNavigationPatch(
        createWorkspaceNavigationPatch({
          openFileTabs,
          activeFileTabId,
          target,
          openInNewTab: Boolean(options.openInNewTab),
          nextTabId: createNextTabId()
        })
      )

      if (node.type === 'directory') {
        if (node.children?.length) {
          setExpandedPaths((current) => {
            if (current.has(node.path)) return current

            const next = new Set(current)
            next.add(node.path)
            return next
          })
        }
      }

      await loadPreview(node.path)
    },
    [
      activeFileTabId,
      applyNavigationPatch,
      createNextTabId,
      discardEditingIfAllowed,
      isEditingTargetPath,
      loadPreview,
      openFileTabs
    ]
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
      if (!isEditingTargetPath(tab.path) && !discardEditingIfAllowed()) return

      setActiveFileTabId(tab.id)
      setActiveFilePath(tab.type === 'directory' ? undefined : tab.path)
      setSelectedPath(tab.path)
      await loadPreview(tab.path)
    },
    [discardEditingIfAllowed, isEditingTargetPath, loadPreview]
  )

  const closeFileTab = useCallback(
    (id: string): void => {
      const closingTab = openFileTabs.find((tab) => tab.id === id)
      if (closingTab && isEditingTargetPath(closingTab.path) && !discardEditingIfAllowed()) return

      const patch = createCloseFileTabPatch({
        openFileTabs,
        activeFileTabId,
        closingTabId: id
      })
      applyNavigationPatch(patch)
      if (activeFileTabId === id) void loadPreview(patch.previewPath)
    },
    [
      activeFileTabId,
      applyNavigationPatch,
      discardEditingIfAllowed,
      isEditingTargetPath,
      loadPreview,
      openFileTabs
    ]
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
      const patch = createHistoryNavigationPatch(openFileTabs, activeFileTabId, delta)
      if (!patch?.target) return
      if (!isEditingTargetPath(patch.target.path) && !discardEditingIfAllowed()) return

      applyNavigationPatch(patch)
      await loadPreview(patch.target.path)
    },
    [
      activeFileTabId,
      applyNavigationPatch,
      discardEditingIfAllowed,
      isEditingTargetPath,
      loadPreview,
      openFileTabs
    ]
  )

  useEffect(() => {
    return window.api.onCloseCurrentTabOrWindow(closeCurrentTabOrWindow)
  }, [closeCurrentTabOrWindow])

  const replaceRepositoryWorkspace = useCallback(
    async (nextRepository: RepositoryPayload): Promise<void> => {
      setRepository(nextRepository)
      setExpandedPaths(defaultExpanded)
      applyNavigationPatch(createResetNavigationPatch())
      await loadPreview('', nextRepository)
    },
    [applyNavigationPatch, loadPreview]
  )

  const checkoutBranch = useCallback(
    async (branch: string): Promise<void> => {
      if (!repository || branch === repository.branch) return
      if (!discardEditingIfAllowed()) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.checkoutBranch(repository.path, branch)
        await replaceRepositoryWorkspace(nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [discardEditingIfAllowed, replaceRepositoryWorkspace, repository, setError]
  )

  const openBranchWorktree = useCallback(
    async (ref: string): Promise<void> => {
      if (!repository) return
      if (!discardEditingIfAllowed()) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.openWorktree(repository.rootPath, ref)
        await replaceRepositoryWorkspace(nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [discardEditingIfAllowed, replaceRepositoryWorkspace, repository, setError]
  )

  const openRepositoryPreview = useCallback((): void => {
    if (!repository) return
    if (!isEditingTargetPath('') && !discardEditingIfAllowed()) return

    const resolved = resolveRepositoryNavigationTarget(repository, '')
    if (!resolved) return

    applyNavigationPatch(
      createWorkspaceNavigationPatch({
        openFileTabs,
        activeFileTabId,
        target: resolved.target,
        openInNewTab: false,
        nextTabId: createNextTabId()
      })
    )
    void loadPreview(resolved.target.path)
  }, [
    activeFileTabId,
    applyNavigationPatch,
    createNextTabId,
    discardEditingIfAllowed,
    isEditingTargetPath,
    loadPreview,
    openFileTabs,
    repository
  ])

  const openBreadcrumbPath = useCallback(
    (path: string): void => {
      if (!repository) return
      if (!isEditingTargetPath(path) && !discardEditingIfAllowed()) return

      const resolved = resolveRepositoryNavigationTarget(repository, path)
      if (resolved?.node) {
        void handleSelect(resolved.node)
        return
      }

      if (!resolved) return

      applyNavigationPatch(
        createWorkspaceNavigationPatch({
          openFileTabs,
          activeFileTabId,
          target: resolved.target,
          openInNewTab: false,
          nextTabId: createNextTabId()
        })
      )
      void loadPreview(resolved.target.path)
    },
    [
      activeFileTabId,
      applyNavigationPatch,
      createNextTabId,
      discardEditingIfAllowed,
      handleSelect,
      isEditingTargetPath,
      loadPreview,
      openFileTabs,
      repository
    ]
  )

  const selectPreviewPath = useCallback(
    (path: string, openInNewTab = false, hash?: string): boolean => {
      if (!isEditingTargetPath(path) && !discardEditingIfAllowed()) return false

      const resolved = repository ? resolveRepositoryNavigationTarget(repository, path) : undefined
      if (resolved?.node) {
        if (hash) {
          queuePendingMarkdownAnchor(resolved.target.path, hash)
        }
        setExpandedPaths(
          (current) => new Set([...current, '', ...parentPaths(resolved.target.path)])
        )
        void handleSelect(resolved.node, { openInNewTab })
        return true
      }

      if (resolved) {
        if (hash) {
          queuePendingMarkdownAnchor(resolved.target.path, hash)
        }
        setExpandedPaths(
          (current) => new Set([...current, '', ...parentPaths(resolved.target.path)])
        )
        applyNavigationPatch(
          createWorkspaceNavigationPatch({
            openFileTabs,
            activeFileTabId,
            target: resolved.target,
            openInNewTab,
            nextTabId: createNextTabId()
          })
        )
        void loadPreview(resolved.target.path)
        return true
      }

      setError(`${fileNameFromPath(path)} is no longer available in this repository.`)
      return false
    },
    [
      activeFileTabId,
      applyNavigationPatch,
      createNextTabId,
      discardEditingIfAllowed,
      handleSelect,
      isEditingTargetPath,
      loadPreview,
      openFileTabs,
      queuePendingMarkdownAnchor,
      repository,
      setError
    ]
  )

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

  useEffect(() => {
    return window.api.onSaveCurrentFile(() => {
      void saveCurrentFile()
    })
  }, [saveCurrentFile])

  return {
    repositoryState: {
      repository,
      selectedPath,
      expandedPaths,
      loading,
      error,
      breadcrumbParts: selectedPath ? selectedPath.split('/').filter(Boolean) : [],
      repositoryLabel: repository ? getRepositoryLabel(repository) : ''
    },
    previewState: {
      preview,
      previewLoading,
      pendingMarkdownAnchor,
      clearPendingMarkdownAnchor,
      showMarkdownLinkContextMenu
    },
    editingState: {
      isEditing,
      isSaving,
      canEditPreview,
      draftContent,
      hasUnsavedChanges,
      startEditing,
      cancelEditing,
      updateDraftContent,
      saveCurrentFile
    },
    layoutState: {
      isSidebarOpen,
      setIsSidebarOpen,
      sidebarWidth,
      isResizing,
      startResizing
    },
    tabState: {
      openFileTabs,
      activeFileTabId,
      titlebarTabsRef,
      tabPopover,
      tabPopoverStyle,
      showTabPopover,
      hideTabPopover,
      handleTitlebarTabsPointerLeave,
      selectFileTab,
      closeFileTab,
      canNavigateBack: canMoveTabHistory(openFileTabs, activeFileTabId, -1),
      canNavigateForward: canMoveTabHistory(openFileTabs, activeFileTabId, 1)
    },
    navigationActions: {
      openRepository,
      handleSelect,
      toggleDirectory,
      showTreeItemContextMenu,
      showBreadcrumbContextMenu,
      navigateActiveTabHistory,
      checkoutBranch,
      openBranchWorktree,
      openRepositoryPreview,
      openBreadcrumbPath,
      selectPreviewPath
    },
    settingsState: {
      settings,
      isSettingsOpen,
      openSettings,
      closeSettings,
      saveSettings
    }
  }
}
