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
import {
  fileNameFromPath,
  findTreeNode,
  getRepositoryLabel,
  hydrateOpenFileTab,
  parentPaths
} from '../app-utils'
import type {
  PreviewPayload,
  RecentFileState,
  RepositoryPayload,
  SessionState,
  TreeNode
} from '../../../shared/types'

const defaultExpanded = new Set([''])

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
  selectFileTab: (tab: OpenFileTab) => Promise<void>
  closeFileTab: (id: string) => void
  navigateActiveTabHistory: (delta: -1 | 1) => Promise<void>
  switchRef: (ref: string) => Promise<void>
  openRepositoryPreview: () => void
  openBreadcrumbPath: (path: string) => void
  selectPreviewPath: (path: string, openInNewTab?: boolean) => boolean
  breadcrumbParts: string[]
  repositoryLabel: string
  canNavigateBack: boolean
  canNavigateForward: boolean
} {
  const didRestoreSession = useRef(false)
  const nextTabId = useRef(0)
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

  const openRepository = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(undefined)

    try {
      const nextRepository = await window.api.pickRepository()
      if (!nextRepository) return

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
  }, [loadPreview])

  const loadRepositoryPath = useCallback(
    async (repoPath: string): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.loadRepository(repoPath)
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
    [loadPreview]
  )

  const loadRepositoryWithSession = useCallback(
    async (session: SessionState): Promise<void> => {
      if (!session.repositoryPath) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository =
          session.source === 'git-ref' && session.activeRef
            ? await window.api.loadRef(
                session.rootPath ?? session.repositoryPath,
                session.activeRef,
                session.rootPath
              )
            : await window.api.loadRepository(session.repositoryPath)
        const restoredTabs = session.openFileTabs
          .filter((tab) => {
            const node = findTreeNode(nextRepository.tree, tab.path)
            return node?.type === 'file'
          })
          .map((tab, index) => hydrateOpenFileTab(tab, index))
        const restoredActiveFile =
          session.activeFilePath && restoredTabs.some((tab) => tab.path === session.activeFilePath)
            ? session.activeFilePath
            : restoredTabs[0]?.path
        const restoredActiveTabId =
          restoredTabs.find((tab) => tab.id === session.activeFileTabId)?.id ??
          restoredTabs.find((tab) => tab.path === restoredActiveFile)?.id ??
          restoredTabs[0]?.id
        const selectedPath = restoredActiveFile ?? session.selectedPath ?? ''
        const selectedNode = selectedPath
          ? findTreeNode(nextRepository.tree, selectedPath)
          : undefined
        const nextSelectedPath = selectedNode ? selectedPath : ''

        setRepository(nextRepository)
        setExpandedPaths(new Set(session.expandedPaths.length ? session.expandedPaths : ['']))
        setOpenFileTabs(restoredTabs)
        setActiveFilePath(restoredActiveFile)
        setActiveFileTabId(restoredActiveTabId)
        setSelectedPath(nextSelectedPath)
        await loadPreview(nextSelectedPath, nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview]
  )

  const openFilePath = useCallback(
    async (file: RecentFileState): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository =
          file.source === 'git-ref' && file.activeRef
            ? await window.api.loadRef(
                file.rootPath ?? file.repoPath,
                file.activeRef,
                file.rootPath
              )
            : await window.api.loadRepository(file.repoPath)
        const filePath = file.filePath
        const node = findTreeNode(nextRepository.tree, filePath)

        setRepository(nextRepository)
        setExpandedPaths(new Set(['', ...parentPaths(filePath)]))

        if (node?.type === 'file') {
          setSelectedPath(filePath)
          setActiveFilePath(filePath)
          const tab = createFileTab({ path: filePath, name: node.name }, createNextTabId())
          setActiveFileTabId(tab.id)
          setOpenFileTabs((current) =>
            repository?.path === nextRepository.path
              ? [...current.filter((item) => item.path !== filePath), tab]
              : [tab]
          )
          await loadPreview(filePath, nextRepository)
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

  useEffect(() => {
    if (didRestoreSession.current) return
    didRestoreSession.current = true

    void window.api.getSession().then((session) => {
      if (!session.repositoryPath) return
      void loadRepositoryWithSession(session)
    })
  }, [loadRepositoryWithSession])

  useEffect(() => {
    const removeOpenPathListener = window.api.onOpenRepositoryPath((repoPath) => {
      void loadRepositoryPath(repoPath)
    })
    const removeOpenFileListener = window.api.onOpenFilePath((file) => {
      void openFilePath(file)
    })
    const removeOpenRequestListener = window.api.onOpenRepositoryRequest(() => {
      void openRepository()
    })

    return () => {
      removeOpenPathListener()
      removeOpenFileListener()
      removeOpenRequestListener()
    }
  }, [loadRepositoryPath, openFilePath, openRepository])

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
        setActiveFileTabId(undefined)
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
          target: { path: node.path, name: node.name },
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
      setActiveFilePath(tab.path)
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
        setActiveFilePath(nextTab.path)
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
      setActiveFilePath(result.target.path)
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
    setSelectedPath('')
    setActiveFilePath(undefined)
    setActiveFileTabId(undefined)
    void loadPreview('')
  }, [loadPreview])

  const openBreadcrumbPath = useCallback(
    (path: string): void => {
      setSelectedPath(path)
      setActiveFilePath(undefined)
      setActiveFileTabId(undefined)
      void loadPreview(path)
    },
    [loadPreview]
  )

  const selectPreviewPath = useCallback(
    (path: string, openInNewTab = false): boolean => {
      const node = repository ? findTreeNode(repository.tree, path) : undefined
      if (node) {
        void handleSelect(node, { openInNewTab })
        return true
      }

      setError(`${fileNameFromPath(path)} is no longer available in this repository.`)
      return false
    },
    [handleSelect, repository]
  )

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
    selectFileTab,
    closeFileTab,
    navigateActiveTabHistory,
    switchRef,
    openRepositoryPreview,
    openBreadcrumbPath,
    selectPreviewPath,
    breadcrumbParts: selectedPath ? selectedPath.split('/').filter(Boolean) : [],
    repositoryLabel: repository ? getRepositoryLabel(repository) : '',
    canNavigateBack: canMoveTabHistory(openFileTabs, activeFileTabId, -1),
    canNavigateForward: canMoveTabHistory(openFileTabs, activeFileTabId, 1)
  }
}
