import { useCallback, useEffect, useRef, useState } from 'react'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  GitBranch,
  Loader2,
  Plus,
  Search,
  X
} from 'lucide-react'
import { iconForNode } from '../app-utils'
import { getDirectoryReadmeBreadcrumbSource } from '../breadcrumb-display'
import { getSelectedPreviewSearchText, getSteppedSearchIndex } from '../preview-search'
import { GlobalSearchModal } from './GlobalSearchModal'
import { PreviewContent } from './PreviewContent'
import { TreeRow } from './TreeRow'
import type { RepositoryWorkspace } from '../hooks/useRepositoryWorkspace'

export function WorkspaceView(workspace: RepositoryWorkspace): React.JSX.Element {
  const {
    repository,
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
    showBreadcrumbContextMenu: openBreadcrumbContextMenu,
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
    selectedPath,
    breadcrumbParts,
    repositoryLabel,
    canNavigateBack,
    canNavigateForward
  } = workspace
  const directoryReadmeSource = getDirectoryReadmeBreadcrumbSource(preview)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const previewBodyRef = useRef<HTMLDivElement | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchCount, setSearchMatchCount] = useState(0)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const appliedSearchQuery = isSearchOpen ? searchQuery : ''
  const openPreviewSearch = useCallback(() => {
    const selectedText = getSelectedPreviewSearchText(window.getSelection(), previewBodyRef.current)
    if (selectedText) {
      setSearchQuery(selectedText)
      setActiveSearchIndex(-1)
    }

    setIsSearchOpen(true)
    setSearchFocusRequest((request) => request + 1)
  }, [])
  const closePreviewSearch = useCallback(() => {
    setIsSearchOpen(false)
    setActiveSearchIndex(-1)
  }, [])
  const stepSearchMatch = useCallback(
    (direction: -1 | 1): void => {
      setActiveSearchIndex((currentIndex) =>
        getSteppedSearchIndex({
          currentIndex,
          matchCount: searchMatchCount,
          direction
        })
      )
    },
    [searchMatchCount]
  )
  const handleSearchMatchCountChange = useCallback((count: number): void => {
    setSearchMatchCount(count)
    setActiveSearchIndex((currentIndex) => {
      if (count <= 0) return -1
      if (currentIndex < 0) return 0
      return Math.min(currentIndex, count - 1)
    })
  }, [])
  const showBreadcrumbContextMenu = (event: React.MouseEvent<HTMLElement>, path: string): void => {
    event.preventDefault()
    void openBreadcrumbContextMenu(path)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault()
        closePreviewSearch()
        return
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault()
        setIsGlobalSearchOpen(true)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault()
        openPreviewSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePreviewSearch, isSearchOpen, openPreviewSearch])

  useEffect(() => {
    return window.api.onOpenGlobalSearch(() => setIsGlobalSearchOpen(true))
  }, [])

  useEffect(() => {
    return window.api.onOpenCurrentTabSearch(openPreviewSearch)
  }, [openPreviewSearch])

  useEffect(() => {
    if (!isSearchOpen) return

    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [isSearchOpen, searchFocusRequest])
  const fileTabsNav = (
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
            key={tab.id}
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
            {iconForNode({ type: tab.type ?? 'file', name: tab.name })}
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
  )

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
                  <TitlebarWindowControls />
                  <div className="titlebar-repository" title={repositoryLabel}>
                    {repositoryLabel}
                  </div>
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
                    <Plus size={16} />
                  </button>
                  <button
                    className="sidebar-control-button"
                    type="button"
                    aria-label="Search files"
                    aria-expanded={isGlobalSearchOpen}
                    onClick={() => setIsGlobalSearchOpen(true)}
                  >
                    <Search size={16} />
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
                      onOpenContextMenu={showTreeItemContextMenu}
                    />
                  ))}
                </div>
              </aside>

              <div
                aria-label="Resize panels"
                className="split-resizer"
                role="separator"
                tabIndex={0}
                onMouseDown={startResizing}
              />
            </>
          )}

          <section className="preview-panel">
            <div className="main-titlebar">
              {!isSidebarOpen && <TitlebarWindowControls />}
              <div className="main-titlebar-actions">
                <button
                  className="titlebar-icon-button"
                  type="button"
                  aria-label={isSidebarOpen ? 'Hide files' : 'Show files'}
                  aria-expanded={isSidebarOpen}
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  {isSidebarOpen ? (
                    <IconLayoutSidebarLeftCollapse size={20} stroke={2} />
                  ) : (
                    <IconLayoutSidebarLeftExpand size={20} stroke={2} />
                  )}
                </button>
                <HistoryButtons
                  canNavigateBack={canNavigateBack}
                  canNavigateForward={canNavigateForward}
                  onNavigate={navigateActiveTabHistory}
                />
              </div>
              {fileTabsNav}
            </div>
            <div className="repo-pathbar">
              <div className="breadcrumb">
                <button
                  type="button"
                  title={repository.name}
                  onClick={openRepositoryPreview}
                  onContextMenu={(event) => showBreadcrumbContextMenu(event, '')}
                >
                  {repository.name}
                </button>
                {!breadcrumbParts.length && directoryReadmeSource && (
                  <span
                    className="breadcrumb-source"
                    title={directoryReadmeSource.path}
                    aria-label={`Showing ${directoryReadmeSource.path}`}
                  >
                    <span aria-hidden="true">·</span>
                    {directoryReadmeSource.name}
                  </span>
                )}
                {breadcrumbParts.map((part, index) => {
                  const path = breadcrumbParts.slice(0, index + 1).join('/')
                  const isLast = index === breadcrumbParts.length - 1

                  return (
                    <span className={isLast ? 'breadcrumb-current' : undefined} key={path}>
                      <span className="slash">/</span>
                      {isLast ? (
                        <>
                          <strong title={part}>{part}</strong>
                          {directoryReadmeSource && (
                            <span
                              className="breadcrumb-source"
                              title={directoryReadmeSource.path}
                              aria-label={`Showing ${directoryReadmeSource.path}`}
                            >
                              <span aria-hidden="true">·</span>
                              {directoryReadmeSource.name}
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          title={part}
                          onClick={() => openBreadcrumbPath(path)}
                          onContextMenu={(event) => showBreadcrumbContextMenu(event, path)}
                        >
                          {part}
                        </button>
                      )}
                    </span>
                  )
                })}
              </div>
              <button
                className="path-search-button"
                type="button"
                aria-label="Find in current tab"
                aria-expanded={isSearchOpen}
                onClick={openPreviewSearch}
              >
                <Search size={15} />
              </button>
            </div>

            <div className="preview-body" ref={previewBodyRef}>
              {previewLoading && (
                <div className="loading-state">
                  <Loader2 className="spin" size={26} />
                </div>
              )}
              {!previewLoading && preview && (
                <PreviewContent
                  pendingAnchor={pendingMarkdownAnchor}
                  preview={preview}
                  searchQuery={appliedSearchQuery}
                  activeSearchIndex={activeSearchIndex}
                  onSearchMatchCountChange={handleSearchMatchCountChange}
                  onSelectPath={selectPreviewPath}
                  onOpenMarkdownLinkContextMenu={showMarkdownLinkContextMenu}
                  onMarkdownAnchorHandled={clearPendingMarkdownAnchor}
                />
              )}
            </div>
            {isSearchOpen && (
              <form
                className="preview-search-popover"
                role="search"
                aria-label="Find in current tab"
                onSubmit={(event) => {
                  event.preventDefault()
                  stepSearchMatch(1)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    closePreviewSearch()
                    return
                  }

                  if (event.key === 'Enter') {
                    event.preventDefault()
                    stepSearchMatch(event.shiftKey ? -1 : 1)
                  }
                }}
              >
                <Search className="preview-search-icon" size={15} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  aria-label="Find in current tab"
                  value={searchQuery}
                  placeholder="Find"
                  onChange={(event) => {
                    setSearchQuery(event.target.value)
                    setActiveSearchIndex(-1)
                  }}
                />
                <span className="preview-search-count" aria-live="polite">
                  {searchQuery.trim()
                    ? searchMatchCount > 0
                      ? `${activeSearchIndex + 1}/${searchMatchCount}`
                      : '0/0'
                    : '0/0'}
                </span>
                <button
                  className="preview-search-button"
                  type="button"
                  aria-label="Previous match"
                  disabled={searchMatchCount === 0}
                  onClick={() => stepSearchMatch(-1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  className="preview-search-button"
                  type="button"
                  aria-label="Next match"
                  disabled={searchMatchCount === 0}
                  onClick={() => stepSearchMatch(1)}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  className="preview-search-button"
                  type="button"
                  aria-label="Close find"
                  onClick={closePreviewSearch}
                >
                  <X size={15} />
                </button>
              </form>
            )}
          </section>
          <GlobalSearchModal
            open={isGlobalSearchOpen}
            repository={repository}
            onOpenChange={setIsGlobalSearchOpen}
            onOpenResult={(result) => {
              selectPreviewPath(result.path)
            }}
          />
        </section>
      )}
    </main>
  )
}

function TitlebarWindowControls(): React.JSX.Element {
  return (
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
  )
}

function HistoryButtons({
  canNavigateBack,
  canNavigateForward,
  onNavigate
}: {
  canNavigateBack: boolean
  canNavigateForward: boolean
  onNavigate: (delta: -1 | 1) => Promise<void>
}): React.JSX.Element {
  return (
    <>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label="Back"
        disabled={!canNavigateBack}
        onClick={() => void onNavigate(-1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label="Forward"
        disabled={!canNavigateForward}
        onClick={() => void onNavigate(1)}
      >
        <ChevronRight size={16} />
      </button>
    </>
  )
}
