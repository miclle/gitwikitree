import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import {
  escapeHtml,
  getMarkdownPreview,
  isExternalLink,
  markdownHeadingId,
  markdownToHtml,
  resolveMarkdownLinkPath
} from './markdown-preview'
import {
  canMoveTabHistory,
  createFileTab,
  moveActiveTabHistory,
  navigateFileTabs,
  type OpenFileTab
} from './app-navigation'
import { getTreeIcon } from './tree-icons'
import type {
  NavigationTarget,
  PreviewPayload,
  RecentFileState,
  RepositoryPayload,
  SessionState,
  TreeNode
} from '../../shared/types'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  File,
  FileText,
  Folder,
  GitBranch,
  Loader2,
  Plus,
  Search,
  X
} from 'lucide-react'

type Repository = RepositoryPayload
type Preview = PreviewPayload

type TabPopoverState = {
  tab: OpenFileTab
  left: number
  visible: boolean
}

const defaultExpanded = new Set([''])
const tabPopoverWidth = 280
const tabPopoverInset = 8

function getRepositoryLabel(repository: Repository): string {
  const parts = repository.rootPath.split(/[\\/]/).filter(Boolean)
  const owner = parts.at(-2)
  return owner ? `${owner}/${repository.name}` : repository.name
}

function findTreeNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node

    if (node.children) {
      const match = findTreeNode(node.children, path)
      if (match) return match
    }
  }

  return undefined
}

function fileNameFromPath(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function fallbackTabId(tab: NavigationTarget, index: number): string {
  return `tab-${index}-${tab.path.replace(/[^a-z0-9]/gi, '-')}`
}

function hydrateOpenFileTab(
  tab: {
    path: string
    name: string
    id?: string
    history?: NavigationTarget[]
    historyIndex?: number
  },
  index: number
): OpenFileTab {
  const target = { path: tab.path, name: tab.name }
  const history = tab.history?.length ? tab.history : [target]
  const historyIndex =
    typeof tab.historyIndex === 'number'
      ? Math.min(Math.max(tab.historyIndex, 0), history.length - 1)
      : history.findIndex((item) => item.path === tab.path)

  return {
    id: tab.id ?? fallbackTabId(tab, index),
    ...target,
    history,
    historyIndex: historyIndex >= 0 ? historyIndex : history.length - 1
  }
}

function shouldOpenInNewTab(event: {
  button?: number
  ctrlKey?: boolean
  metaKey?: boolean
}): boolean {
  return event.button === 1 || Boolean(event.ctrlKey || event.metaKey)
}

function parentPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

function iconForNode(node: Pick<TreeNode, 'type' | 'name'>, expanded = false): React.JSX.Element {
  const treeIcon = getTreeIcon(node, expanded)
  if (treeIcon) {
    return <img alt={treeIcon.alt} className="tree-icon" draggable={false} src={treeIcon.src} />
  }

  return node.type === 'directory' ? (
    <Folder className="tree-icon" size={16} />
  ) : (
    <File className="tree-icon" size={16} />
  )
}

function App(): React.JSX.Element {
  const didRestoreSession = useRef(false)
  const titlebarTabsRef = useRef<HTMLElement | null>(null)
  const tabPopoverTimer = useRef<number | undefined>(undefined)
  const tabPopoverHideTimer = useRef<number | undefined>(undefined)
  const isTabPopoverVisible = useRef(false)
  const nextTabId = useRef(0)
  const [repository, setRepository] = useState<Repository | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded)
  const [preview, setPreview] = useState<Preview | undefined>()
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [sidebarWidth, setSidebarWidth] = useState(360)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openFileTabs, setOpenFileTabs] = useState<OpenFileTab[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [activeFileTabId, setActiveFileTabId] = useState<string | undefined>()
  const [tabPopover, setTabPopover] = useState<TabPopoverState | undefined>()
  const [isResizing, setIsResizing] = useState(false)

  const createNextTabId = useCallback((): string => {
    nextTabId.current += 1
    return `tab-${Date.now().toString(36)}-${nextTabId.current}`
  }, [])

  const loadPreview = useCallback(
    async (path: string, repo = repository): Promise<Preview | undefined> => {
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

  useEffect(() => {
    if (!repository) return

    const handle = window.setTimeout(() => {
      void window.api.saveSession({
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath,
        activeFilePath,
        activeFileTabId,
        openFileTabs,
        expandedPaths: Array.from(expandedPaths)
      })
    }, 250)

    return () => window.clearTimeout(handle)
  }, [activeFilePath, activeFileTabId, expandedPaths, openFileTabs, repository, selectedPath])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent): void => {
      setSidebarWidth(Math.min(Math.max(event.clientX, 280), 520))
    }
    const handleMouseUp = (): void => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

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

  const clearTabPopoverTimer = useCallback((): void => {
    if (tabPopoverTimer.current === undefined) return
    window.clearTimeout(tabPopoverTimer.current)
    tabPopoverTimer.current = undefined
  }, [])

  const clearTabPopoverHideTimer = useCallback((): void => {
    if (tabPopoverHideTimer.current === undefined) return
    window.clearTimeout(tabPopoverHideTimer.current)
    tabPopoverHideTimer.current = undefined
  }, [])

  const getTabPopoverLeft = useCallback((tabElement: HTMLElement): number => {
    const tabsRect = titlebarTabsRef.current?.getBoundingClientRect()
    const tabRect = tabElement.getBoundingClientRect()
    const center = tabRect.left + tabRect.width / 2 - (tabsRect?.left ?? 0)

    if (!tabsRect) return center

    const popoverWidth = Math.min(tabPopoverWidth, window.innerWidth * 0.7)
    const minLeft = popoverWidth / 2 + tabPopoverInset
    const maxLeft = tabsRect.width - popoverWidth / 2 - tabPopoverInset

    if (maxLeft < minLeft) return tabsRect.width / 2

    return Math.min(Math.max(center, minLeft), maxLeft)
  }, [])

  const showTabPopover = useCallback(
    (tab: OpenFileTab, tabElement: HTMLElement): void => {
      clearTabPopoverTimer()
      clearTabPopoverHideTimer()

      const left = getTabPopoverLeft(tabElement)

      if (isTabPopoverVisible.current) {
        setTabPopover({ tab, left, visible: true })
        return
      }

      setTabPopover({ tab, left, visible: false })
      tabPopoverTimer.current = window.setTimeout(() => {
        isTabPopoverVisible.current = true
        tabPopoverTimer.current = undefined
        setTabPopover({ tab, left, visible: true })
      }, 360)
    },
    [clearTabPopoverHideTimer, clearTabPopoverTimer, getTabPopoverLeft]
  )

  const hideTabPopover = useCallback(
    (delayed = false): void => {
      clearTabPopoverTimer()
      clearTabPopoverHideTimer()

      const hide = (): void => {
        tabPopoverHideTimer.current = undefined
        isTabPopoverVisible.current = false
        setTabPopover((current) => (current ? { ...current, visible: false } : undefined))
      }

      if (!delayed) {
        hide()
        return
      }

      tabPopoverHideTimer.current = window.setTimeout(hide, 120)
    },
    [clearTabPopoverHideTimer, clearTabPopoverTimer]
  )

  const handleTitlebarTabsPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
      hideTabPopover(true)
    },
    [hideTabPopover]
  )

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

  const breadcrumbParts = selectedPath ? selectedPath.split('/').filter(Boolean) : []
  const repositoryLabel = repository ? getRepositoryLabel(repository) : ''
  const canNavigateBack = canMoveTabHistory(openFileTabs, activeFileTabId, -1)
  const canNavigateForward = canMoveTabHistory(openFileTabs, activeFileTabId, 1)
  const tabPopoverStyle: CSSProperties | undefined = tabPopover
    ? ({ '--tab-popover-left': `${tabPopover.left}px` } as CSSProperties)
    : undefined

  return (
    <main className={isResizing ? 'app-shell is-resizing' : 'app-shell'}>
      {error && <div className="error-banner">{error}</div>}

      {!repository ? (
        <section className="welcome-state">
          <Code2 size={42} />
          <h2>Open a repository</h2>
          <button
            className="open-button large"
            type="button"
            disabled={loading}
            onClick={openRepository}
          >
            {loading ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
            Open Repository
          </button>
        </section>
      ) : (
        <section
          className={isSidebarOpen ? 'repo-layout' : 'repo-layout sidebar-collapsed'}
          style={{
            gridTemplateColumns: isSidebarOpen
              ? `${sidebarWidth}px 1px minmax(0, 1fr)`
              : 'minmax(0, 1fr)'
          }}
        >
          {isSidebarOpen && (
            <>
              <aside className="tree-panel" aria-label="Files">
                <div className="sidebar-titlebar">
                  <div className="titlebar-window-controls">
                    <button
                      className="window-control close"
                      type="button"
                      aria-label="Close window"
                      onClick={() => window.api.controlWindow('close')}
                    />
                    <button
                      className="window-control minimize"
                      type="button"
                      aria-label="Minimize window"
                      onClick={() => window.api.controlWindow('minimize')}
                    />
                    <button
                      className="window-control zoom"
                      type="button"
                      aria-label="Toggle fullscreen"
                      onClick={() => window.api.controlWindow('toggle-maximize')}
                    />
                  </div>
                  <div className="titlebar-repository" title={repositoryLabel}>
                    {repositoryLabel}
                  </div>
                  <button
                    className="titlebar-icon-button sidebar-toggle-button"
                    type="button"
                    aria-label="Hide files"
                    aria-pressed={isSidebarOpen}
                    onClick={() => setIsSidebarOpen(false)}
                  >
                    <IconLayoutSidebarLeftCollapse size={20} stroke={2} />
                  </button>
                  <button
                    className="titlebar-icon-button"
                    type="button"
                    aria-label="Back"
                    disabled={!canNavigateBack}
                    onClick={() => void navigateActiveTabHistory(-1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="titlebar-icon-button"
                    type="button"
                    aria-label="Forward"
                    disabled={!canNavigateForward}
                    onClick={() => void navigateActiveTabHistory(1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="sidebar-controls">
                  <span className="branch-pill">
                    <GitBranch size={15} />
                    <select
                      aria-label="Branch"
                      disabled={loading}
                      value={repository.activeRef}
                      onChange={(event) => void switchRef(event.target.value)}
                    >
                      {repository.refs.map((ref) => (
                        <option key={`${ref.type}:${ref.name}`} value={ref.name}>
                          {ref.name}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button className="sidebar-control-button" type="button" aria-label="Add">
                    <Plus size={18} />
                  </button>
                  <button
                    className="sidebar-control-button"
                    type="button"
                    aria-label="Search files"
                  >
                    <Search size={18} />
                  </button>
                </div>

                <div className="tree">
                  {repository.tree.map((node) => (
                    <TreeRow
                      expandedPaths={expandedPaths}
                      key={node.path}
                      level={0}
                      node={node}
                      selectedPath={selectedPath}
                      onSelect={handleSelect}
                      onToggle={toggleDirectory}
                    />
                  ))}
                </div>
              </aside>

              <div
                aria-label="Resize panels"
                className="split-resizer"
                role="separator"
                tabIndex={0}
                onMouseDown={() => setIsResizing(true)}
              />
            </>
          )}

          <section className="preview-panel">
            {!isSidebarOpen && (
              <div className="main-titlebar">
                <div className="titlebar-window-controls">
                  <button
                    className="window-control close"
                    type="button"
                    aria-label="Close window"
                    onClick={() => window.api.controlWindow('close')}
                  />
                  <button
                    className="window-control minimize"
                    type="button"
                    aria-label="Minimize window"
                    onClick={() => window.api.controlWindow('minimize')}
                  />
                  <button
                    className="window-control zoom"
                    type="button"
                    aria-label="Toggle fullscreen"
                    onClick={() => window.api.controlWindow('toggle-maximize')}
                  />
                </div>
                <div className="titlebar-repository" title={repositoryLabel}>
                  {repositoryLabel}
                </div>
                <button
                  className="titlebar-icon-button sidebar-toggle-button"
                  type="button"
                  aria-label="Show files"
                  aria-pressed={isSidebarOpen}
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <IconLayoutSidebarLeftExpand size={20} stroke={2} />
                </button>
                <button
                  className="titlebar-icon-button"
                  type="button"
                  aria-label="Back"
                  disabled={!canNavigateBack}
                  onClick={() => void navigateActiveTabHistory(-1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="titlebar-icon-button"
                  type="button"
                  aria-label="Forward"
                  disabled={!canNavigateForward}
                  onClick={() => void navigateActiveTabHistory(1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
            <nav
              className="main-tabs"
              aria-label="Open tabs"
              ref={titlebarTabsRef}
              onPointerLeave={handleTitlebarTabsPointerLeave}
              onBlur={(event) => {
                if (event.currentTarget.contains(event.relatedTarget)) return
                hideTabPopover()
              }}
            >
              {openFileTabs.map((tab) => {
                const active = tab.id === activeFileTabId

                return (
                  <div
                    className={active ? 'main-tab active' : 'main-tab'}
                    role="tab"
                    tabIndex={0}
                    aria-selected={active}
                    key={tab.path}
                    aria-label={`${tab.name} ${tab.path}`}
                    onPointerEnter={(event) => showTabPopover(tab, event.currentTarget)}
                    onFocus={(event) => showTabPopover(tab, event.currentTarget)}
                    onClick={() => void selectFileTab(tab)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      void selectFileTab(tab)
                    }}
                  >
                    <span className="main-tab-corner" aria-hidden="true" />
                    {iconForNode({ type: 'file', name: tab.name })}
                    <span className="main-tab-name">{tab.name}</span>
                    <button
                      className="main-tab-close"
                      type="button"
                      aria-label={`Close ${tab.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        hideTabPopover()
                        closeFileTab(tab.id)
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
              {tabPopover && (
                <span
                  className={tabPopover.visible ? 'main-tab-popover visible' : 'main-tab-popover'}
                  style={tabPopoverStyle}
                  aria-hidden="true"
                >
                  <span className="main-tab-popover-name">{tabPopover.tab.name}</span>
                  <span className="main-tab-popover-path">{tabPopover.tab.path}</span>
                </span>
              )}
            </nav>
            <div className="repo-pathbar">
              <div className="breadcrumb">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPath('')
                    setActiveFilePath(undefined)
                    setActiveFileTabId(undefined)
                    void loadPreview('')
                  }}
                >
                  {repository.name}
                </button>
                {breadcrumbParts.map((part, index) => {
                  const path = breadcrumbParts.slice(0, index + 1).join('/')
                  const isLast = index === breadcrumbParts.length - 1

                  return (
                    <span className={isLast ? 'breadcrumb-current' : undefined} key={path}>
                      <span className="slash">/</span>
                      {isLast ? (
                        <strong>{part}</strong>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPath(path)
                            setActiveFilePath(undefined)
                            setActiveFileTabId(undefined)
                            void loadPreview(path)
                          }}
                        >
                          {part}
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="preview-body">
              {previewLoading && (
                <div className="loading-state">
                  <Loader2 className="spin" size={26} />
                </div>
              )}
              {!previewLoading && preview && (
                <PreviewContent
                  preview={preview}
                  onSelectPath={(path, openInNewTab = false) => {
                    const node = findTreeNode(repository.tree, path)
                    if (node) {
                      void handleSelect(node, { openInNewTab })
                      return true
                    }

                    setError(`${fileNameFromPath(path)} is no longer available in this repository.`)
                    return false
                  }}
                />
              )}
            </div>
          </section>
        </section>
      )}
    </main>
  )
}

function TreeRow({
  node,
  level,
  expandedPaths,
  selectedPath,
  onSelect,
  onToggle
}: {
  node: TreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  onSelect: (node: TreeNode, options?: { openInNewTab?: boolean }) => Promise<void>
  onToggle: (path: string) => void
}): React.JSX.Element {
  const expanded = expandedPaths.has(node.path)
  const hasChildren = node.type === 'directory' && Boolean(node.children?.length)
  const selectNode = (openInNewTab = false): void => {
    void onSelect(node, { openInNewTab })
  }

  return (
    <>
      <div
        aria-selected={selectedPath === node.path}
        className={selectedPath === node.path ? 'tree-row selected' : 'tree-row'}
        role="treeitem"
        style={{ '--level': level } as CSSProperties}
        tabIndex={0}
        onClick={(event) => selectNode(shouldOpenInNewTab(event))}
        onAuxClick={(event) => {
          if (!shouldOpenInNewTab(event)) return
          event.preventDefault()
          selectNode(true)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          selectNode()
        }}
      >
        {node.type === 'directory' ? (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
            className="tree-toggle"
            disabled={!hasChildren}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.path)
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <span className="tree-node-button">
          {iconForNode(node, expanded)}
          <span>{node.name}</span>
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children" style={{ '--level': level } as CSSProperties}>
          {node.children?.map((child) => (
            <TreeRow
              expandedPaths={expandedPaths}
              key={child.path}
              level={level + 1}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  )
}

function highlightCodeLine(line: string): string {
  const tokenPattern =
    /('[^']*'|"[^"]*"|`[^`]*`)|\b(import|from|type|const|let|function|return|if|else|for|while|async|await|try|catch|finally|switch|case|break|continue|true|false|undefined|null)\b|\b(\d+(?:\.\d+)?)\b/g
  let cursor = 0
  let html = ''

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    html += escapeHtml(line.slice(cursor, index))

    if (match[1]) {
      html += `<span class="tok-string">${escapeHtml(match[1])}</span>`
    } else if (match[2]) {
      html += `<span class="tok-keyword">${escapeHtml(match[2])}</span>`
    } else if (match[3]) {
      html += `<span class="tok-number">${escapeHtml(match[3])}</span>`
    }

    cursor = index + match[0].length
  }

  return html + escapeHtml(line.slice(cursor))
}

function CodePreview({ content }: { content: string }): React.JSX.Element {
  const lines = content.split('\n')

  return (
    <table className="code-table" aria-label="Source code">
      <tbody>
        {lines.map((line, index) => (
          <tr key={`${index}-${line}`}>
            <td className="line-number">{index + 1}</td>
            <td className="line-code">
              <span dangerouslySetInnerHTML={{ __html: highlightCodeLine(line) || ' ' }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PreviewContent({
  preview,
  onSelectPath
}: {
  preview: Preview
  onSelectPath: (path: string, openInNewTab?: boolean) => boolean
}): React.JSX.Element {
  const scrollToMarkdownAnchor = (href: string, container: HTMLElement): void => {
    const hash = href.trim().slice(1)
    if (!hash) return

    let anchor = hash
    try {
      anchor = decodeURIComponent(hash)
    } catch {
      anchor = hash
    }

    const escapedAnchor = CSS.escape(anchor)
    const target = container.querySelector<HTMLElement>(
      `[id="${escapedAnchor}"], [name="${escapedAnchor}"]`
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleMarkdownLinkClick = (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return

    const link = event.target.closest<HTMLAnchorElement>('a[data-markdown-link]')
    if (!link || !event.currentTarget.contains(link)) return

    const href = link.getAttribute('href') ?? ''
    event.preventDefault()

    if (href.trim().startsWith('#')) {
      scrollToMarkdownAnchor(href, event.currentTarget)
      return
    }

    if (isExternalLink(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    const nextPath = resolveMarkdownLinkPath(href, sourcePath)
    if (nextPath) onSelectPath(nextPath, shouldOpenInNewTab(event))
  }

  if (preview.kind === 'directory') {
    if (preview.readme) {
      const markdownPreview = getMarkdownPreview(preview.readme.content)

      return (
        <article
          className="markdown-body"
          onAuxClick={handleMarkdownLinkClick(preview.readme.path)}
          onClick={handleMarkdownLinkClick(preview.readme.path)}
        >
          {markdownPreview.title && (
            <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
          )}
          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownPreview.content) }} />
        </article>
      )
    }

    return (
      <div className="directory-list">
        {(preview.entries ?? []).map((entry) => (
          <button
            key={entry.path}
            type="button"
            onAuxClick={(event) => {
              if (!shouldOpenInNewTab(event)) return
              event.preventDefault()
              onSelectPath(entry.path, true)
            }}
            onClick={(event) => onSelectPath(entry.path, shouldOpenInNewTab(event))}
          >
            {iconForNode(entry)}
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    )
  }

  if (preview.previewType === 'markdown' && preview.content) {
    const markdownPreview = getMarkdownPreview(preview.content)

    return (
      <article
        className="markdown-body"
        onAuxClick={handleMarkdownLinkClick(preview.path)}
        onClick={handleMarkdownLinkClick(preview.path)}
      >
        {markdownPreview.title && (
          <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
        )}
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownPreview.content) }} />
      </article>
    )
  }

  if (preview.previewType === 'html' && preview.content) {
    return (
      <iframe className="html-preview" title={preview.path} sandbox="" srcDoc={preview.content} />
    )
  }

  if (preview.previewType === 'svg' && preview.content) {
    return (
      <div className="image-preview">
        <img
          alt={preview.name}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.content)}`}
        />
      </div>
    )
  }

  if (preview.previewType === 'image' && preview.dataUrl) {
    return (
      <div className="image-preview">
        <img alt={preview.name} src={preview.dataUrl} />
      </div>
    )
  }

  if (preview.content) {
    return <CodePreview content={preview.content} />
  }

  return (
    <div className="unsupported-preview">
      <FileText size={32} />
      <strong>Preview unavailable</strong>
      <span>This file type is not rendered yet.</span>
    </div>
  )
}

export default App
