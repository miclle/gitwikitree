import { useCallback, useEffect, useRef, useState } from 'react'
import {
  canMoveTabHistory,
  getAdjacentFileTab,
  getFileTabForShortcutPosition,
  type OpenFileTab
} from '../app-navigation'
import { usePanelResize } from './usePanelResize'
import { usePendingMarkdownAnchor } from './usePendingMarkdownAnchor'
import { useRepositoryLaunchIntents } from './useRepositoryLaunchIntents'
import { useRepositoryPreviewLoader } from './useRepositoryPreviewLoader'
import { useSessionPersistence } from './useSessionPersistence'
import { useTabPopover } from './useTabPopover'
import { useWorkspaceEditing } from './useWorkspaceEditing'
import { useWorkspaceSettings } from './useWorkspaceSettings'
import { getRepositoryLabel } from '../repository-label'
import { fileNameFromPath, parentPaths } from '../workspace-paths'
import { resolveRepositoryNavigationTarget } from '../repository-navigation'
import { createPreviewPathNavigation } from '../workspace-preview-navigation'
import { createRestoredRepositorySession } from '../workspace-session-restore'
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
  MarkdownLinkContext,
  MarkdownLinkOpenPayload,
  NavigationTarget,
  PreviewPayload,
  ProjectSessionState,
  RecentFileState,
  RepositoryPayload,
  RepositorySource,
  SessionState,
  FileTabShortcutDirection,
  FileTabShortcutPosition,
  TreeItemOpenPayload,
  TreeNode,
  AppSettings
} from '../../../shared/types'

const defaultExpanded = new Set([''])
const homeFileRepositoryReloadDelayMs = 450

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

function renamedPathFor(path: string, nextName: string): string {
  const parts = path.split('/').filter(Boolean)
  parts[parts.length - 1] = nextName
  return parts.join('/')
}

function replaceMovedPath(
  path: string | undefined,
  fromPath: string,
  toPath: string
): string | undefined {
  if (!path) return path
  if (path === fromPath) return toPath
  if (path.startsWith(`${fromPath}/`)) return `${toPath}${path.slice(fromPath.length)}`
  return path
}

function replaceMovedTarget<T extends NavigationTarget>(
  target: T,
  fromPath: string,
  toPath: string
): T {
  const nextPath = replaceMovedPath(target.path, fromPath, toPath)
  if (!nextPath || nextPath === target.path) return target

  return {
    ...target,
    path: nextPath,
    name: fileNameFromPath(nextPath)
  }
}

function replaceMovedTab(tab: OpenFileTab, fromPath: string, toPath: string): OpenFileTab {
  const nextTarget = replaceMovedTarget(tab, fromPath, toPath)

  return {
    ...tab,
    ...nextTarget,
    history: tab.history?.map((target) => replaceMovedTarget(target, fromPath, toPath))
  }
}

function isPathWithin(path: string | undefined, parentPath: string): boolean {
  return Boolean(path && (path === parentPath || path.startsWith(`${parentPath}/`)))
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

type RepositoryState = {
  repository: RepositoryPayload | undefined
  selectedPath: string
  expandedPaths: Set<string>
  renamingPath: string | undefined
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
  renameTreeItem: (path: string, nextName: string) => Promise<void>
  cancelRenameTreeItem: () => void
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
  const homeFileRepositoryReloadTimeoutRef = useRef<number | undefined>(undefined)
  const [repository, setRepository] = useState<RepositoryPayload | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [renamingPath, setRenamingPath] = useState<string | undefined>()
  const repositoryRef = useRef<RepositoryPayload | undefined>(repository)
  const selectedPathRef = useRef(selectedPath)
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

  useEffect(() => {
    repositoryRef.current = repository
  }, [repository])

  useEffect(() => {
    selectedPathRef.current = selectedPath
  }, [selectedPath])

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

  const runRepositoryLoading = useCallback(
    async (task: () => Promise<void>): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        await task()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [setError]
  )

  const clearHomeFileRepositoryReload = useCallback((): void => {
    if (homeFileRepositoryReloadTimeoutRef.current) {
      window.clearTimeout(homeFileRepositoryReloadTimeoutRef.current)
      homeFileRepositoryReloadTimeoutRef.current = undefined
    }
  }, [])

  useEffect(() => {
    return clearHomeFileRepositoryReload
  }, [clearHomeFileRepositoryReload])

  const reloadRepositoryForHomeFiles = useCallback((): void => {
    clearHomeFileRepositoryReload()

    homeFileRepositoryReloadTimeoutRef.current = window.setTimeout(() => {
      homeFileRepositoryReloadTimeoutRef.current = undefined
      const nextRepositoryContext = repositoryRef.current
      if (!nextRepositoryContext) return

      void runRepositoryLoading(async () => {
        const nextRepository = await window.api.loadRepository(nextRepositoryContext.path)
        setRepository(nextRepository)
        await loadPreview(selectedPathRef.current, nextRepository)
      })
    }, homeFileRepositoryReloadDelayMs)
  }, [clearHomeFileRepositoryReload, loadPreview, runRepositoryLoading])

  const { settings, isSettingsOpen, openSettings, closeSettings, saveSettings, t } =
    useWorkspaceSettings({
      onHomeFileNamesChange: reloadRepositoryForHomeFiles
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

  const openRepositoryRoot = useCallback(
    async (
      nextRepository: RepositoryPayload,
      options: { resetLayout?: boolean } = {}
    ): Promise<void> => {
      setRepository(nextRepository)
      if (options.resetLayout) resetRepositoryLayout()
      setExpandedPaths(defaultExpanded)
      applyNavigationPatch(createResetNavigationPatch())
      await loadPreview('', nextRepository)
    },
    [applyNavigationPatch, loadPreview, resetRepositoryLayout]
  )

  const restoreRepositorySession = useCallback(
    async (nextRepository: RepositoryPayload, session: ProjectSessionState): Promise<void> => {
      const restoredSession = createRestoredRepositorySession(nextRepository, session)

      setRepository(nextRepository)
      setExpandedPaths(restoredSession.expandedPaths)
      setOpenFileTabs(restoredSession.openFileTabs)
      setActiveFilePath(restoredSession.activeFilePath)
      setActiveFileTabId(restoredSession.activeFileTabId)
      setSelectedPath(restoredSession.selectedPath)
      if (session.sidebarWidth) setSidebarWidth(session.sidebarWidth)
      if (typeof session.isSidebarOpen === 'boolean') {
        setIsSidebarOpen(session.isSidebarOpen)
      }
      await loadPreview(restoredSession.selectedPath, nextRepository)
    },
    [loadPreview, setSidebarWidth]
  )

  const restoreProjectSession = useCallback(
    async (fallbackRepository: RepositoryPayload, session: ProjectSessionState): Promise<void> => {
      await restoreRepositorySession(
        await loadRepositoryForProjectSession(fallbackRepository, session),
        session
      )
    },
    [restoreRepositorySession]
  )

  const openRepository = useCallback(async (): Promise<void> => {
    if (!discardEditingIfAllowed()) return

    await runRepositoryLoading(async () => {
      const nextRepository = await window.api.pickRepository()
      if (!nextRepository) return

      const projectSession = await window.api.getProjectSession(nextRepository.path)
      if (projectSession) {
        await restoreProjectSession(nextRepository, projectSession)
        return
      }

      await openRepositoryRoot(nextRepository, { resetLayout: true })
    })
  }, [discardEditingIfAllowed, openRepositoryRoot, restoreProjectSession, runRepositoryLoading])

  const loadRepositoryPath = useCallback(
    async (repoPath: string): Promise<void> => {
      if (!discardEditingIfAllowed()) return

      await runRepositoryLoading(async () => {
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
          await restoreProjectSession(nextRepository, normalizedProjectSession)
          return
        }

        await openRepositoryRoot(nextRepository, { resetLayout: true })
      })
    },
    [
      discardEditingIfAllowed,
      openRepositoryRoot,
      restoreProjectSession,
      restoreRepositorySession,
      runRepositoryLoading
    ]
  )

  const loadRepositoryWithSession = useCallback(
    async (session: SessionState): Promise<void> => {
      const repositoryPath = session.repositoryPath
      if (!repositoryPath) return

      await runRepositoryLoading(async () => {
        const nextRepository = await loadRepositoryFromContext({
          repoPath: repositoryPath,
          rootPath: session.rootPath,
          activeRef: session.activeRef,
          source: session.source
        })
        await restoreRepositorySession(nextRepository, session)
      })
    },
    [restoreRepositorySession, runRepositoryLoading]
  )

  const openFilePath = useCallback(
    async (file: RecentFileState): Promise<void> => {
      if (!discardEditingIfAllowed()) return

      await runRepositoryLoading(async () => {
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
      })
    },
    [
      createNextTabId,
      discardEditingIfAllowed,
      loadPreview,
      repository,
      runRepositoryLoading,
      setError
    ]
  )

  const openTreeItem = useCallback(
    async (item: TreeItemOpenPayload): Promise<void> => {
      if (!discardEditingIfAllowed()) return

      await runRepositoryLoading(async () => {
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
      })
    },
    [
      applyNavigationPatch,
      createNextTabId,
      discardEditingIfAllowed,
      loadPreview,
      queuePendingMarkdownAnchor,
      runRepositoryLoading,
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

  const selectFileTabByShortcut = useCallback(
    (position: FileTabShortcutPosition): void => {
      const tab = getFileTabForShortcutPosition(openFileTabs, position)
      if (!tab || tab.id === activeFileTabId) return

      void selectFileTab(tab)
    },
    [activeFileTabId, openFileTabs, selectFileTab]
  )

  const selectAdjacentFileTab = useCallback(
    (delta: FileTabShortcutDirection): void => {
      const tab = getAdjacentFileTab(openFileTabs, activeFileTabId, delta)
      if (!tab) return

      void selectFileTab(tab)
    },
    [activeFileTabId, openFileTabs, selectFileTab]
  )

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

  useEffect(() => {
    return window.api.onSelectFileTabByShortcut(selectFileTabByShortcut)
  }, [selectFileTabByShortcut])

  useEffect(() => {
    return window.api.onSelectAdjacentFileTab(selectAdjacentFileTab)
  }, [selectAdjacentFileTab])

  const replaceRepositoryWorkspace = useCallback(
    async (nextRepository: RepositoryPayload): Promise<void> => {
      await openRepositoryRoot(nextRepository)
    },
    [openRepositoryRoot]
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

    const navigation = createPreviewPathNavigation({
      repository,
      path: '',
      openInNewTab: false,
      activeFileTabId,
      openFileTabs,
      nextTabId: createNextTabId(),
      expandAncestors: false
    })
    if (navigation.kind !== 'patch') return

    applyNavigationPatch(navigation.patch)
    void loadPreview(navigation.previewPath)
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

      const navigation = createPreviewPathNavigation({
        repository,
        path,
        openInNewTab: false,
        activeFileTabId,
        openFileTabs,
        nextTabId: createNextTabId(),
        expandAncestors: false
      })
      if (navigation.kind === 'node') {
        void handleSelect(navigation.node)
        return
      }

      if (navigation.kind !== 'patch') return

      applyNavigationPatch(navigation.patch)
      void loadPreview(navigation.previewPath)
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

      if (!repository) return false

      const navigation = createPreviewPathNavigation({
        repository,
        path,
        openInNewTab,
        activeFileTabId,
        openFileTabs,
        nextTabId: createNextTabId(),
        expandAncestors: true
      })
      if (navigation.kind === 'node') {
        if (hash) {
          queuePendingMarkdownAnchor(navigation.node.path, hash)
        }
        setExpandedPaths((current) => new Set([...current, ...(navigation.expandedPaths ?? [])]))
        void handleSelect(navigation.node, { openInNewTab })
        return true
      }

      if (navigation.kind === 'patch') {
        if (hash) {
          queuePendingMarkdownAnchor(navigation.previewPath, hash)
        }
        setExpandedPaths((current) => new Set([...current, ...(navigation.expandedPaths ?? [])]))
        applyNavigationPatch(navigation.patch)
        void loadPreview(navigation.previewPath)
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

  const startRenamingTreeItem = useCallback((path: string): void => {
    setRenamingPath(path)
  }, [])

  const cancelRenameTreeItem = useCallback((): void => {
    setRenamingPath(undefined)
  }, [])

  const renameTreeItem = useCallback(
    async (path: string, nextName: string): Promise<void> => {
      if (!repository || !path || !discardEditingIfAllowed()) return

      const currentName = fileNameFromPath(path)
      const trimmedName = nextName?.trim()
      setRenamingPath(undefined)
      if (!trimmedName || trimmedName === currentName) return

      await runRepositoryLoading(async () => {
        const nextRepository = await window.api.renamePath(repository.path, path, trimmedName, {
          source: repository.source,
          rootPath: repository.rootPath
        })
        const nextPath = renamedPathFor(path, trimmedName)
        const nextSelectedPath = replaceMovedPath(selectedPathRef.current, path, nextPath) ?? ''

        setRepository(nextRepository)
        setExpandedPaths((current) => new Set([...current, ...parentPaths(nextPath)]))
        setSelectedPath(nextSelectedPath)
        setActiveFilePath((current) => replaceMovedPath(current, path, nextPath))
        setOpenFileTabs((current) => current.map((tab) => replaceMovedTab(tab, path, nextPath)))
        await loadPreview(nextSelectedPath, nextRepository)
      })
    },
    [discardEditingIfAllowed, loadPreview, repository, runRepositoryLoading]
  )

  const deleteTreeItem = useCallback(
    async (path: string): Promise<void> => {
      if (!repository || !path || !discardEditingIfAllowed()) return
      if (!window.confirm(t('tree.deleteConfirm', { name: fileNameFromPath(path) }))) return

      await runRepositoryLoading(async () => {
        const nextRepository = await window.api.deletePath(repository.path, path, {
          source: repository.source,
          rootPath: repository.rootPath
        })
        const fallbackPath = parentPaths(path).at(-1) ?? ''
        const nextSelectedPath = isPathWithin(selectedPathRef.current, path)
          ? fallbackPath
          : selectedPathRef.current

        setRepository(nextRepository)
        setExpandedPaths((current) => {
          const next = new Set(current)
          next.delete(path)
          return next
        })
        setSelectedPath(nextSelectedPath)
        setActiveFilePath((current) => (isPathWithin(current, path) ? undefined : current))
        setActiveFileTabId((currentTabId) => {
          const activeTab = openFileTabs.find((tab) => tab.id === currentTabId)
          if (!activeTab || !isPathWithin(activeTab.path, path)) return currentTabId

          return openFileTabs.find((tab) => !isPathWithin(tab.path, path))?.id
        })
        setOpenFileTabs((current) => current.filter((tab) => !isPathWithin(tab.path, path)))
        await loadPreview(nextSelectedPath, nextRepository)
      })
    },
    [discardEditingIfAllowed, loadPreview, openFileTabs, repository, runRepositoryLoading, t]
  )

  useEffect(() => {
    return window.api.onOpenTreeItemInNewTab((path) => {
      selectPreviewPath(path, true)
    })
  }, [selectPreviewPath])

  useEffect(() => {
    return window.api.onRenameTreeItem((path) => {
      startRenamingTreeItem(path)
    })
  }, [startRenamingTreeItem])

  useEffect(() => {
    return window.api.onDeleteTreeItem((path) => {
      void deleteTreeItem(path)
    })
  }, [deleteTreeItem])

  useEffect(() => {
    return window.api.onOpenMarkdownLink(openMarkdownLink)
  }, [openMarkdownLink])

  useEffect(() => {
    return window.api.onSaveCurrentFile(() => {
      void saveCurrentFile()
    })
  }, [saveCurrentFile])

  useEffect(() => {
    return window.api.onToggleFilesTreeSidebar(() => {
      setIsSidebarOpen((current) => !current)
    })
  }, [])

  return {
    repositoryState: {
      repository,
      selectedPath,
      expandedPaths,
      renamingPath,
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
      renameTreeItem,
      cancelRenameTreeItem,
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
