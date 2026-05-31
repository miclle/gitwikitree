import { useCallback, useEffect, useRef, useState } from 'react'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Eye,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Search,
  X
} from 'lucide-react'
import { iconForNode } from '../app-utils'
import { getDirectoryReadmeBreadcrumbSource } from '../breadcrumb-display'
import { getSelectedPreviewSearchText, getSteppedSearchIndex } from '../preview-search'
import { FileEditor } from './FileEditor'
import { GlobalSearchModal } from './GlobalSearchModal'
import { PreviewContent } from './PreviewContent'
import { StatusBar } from './StatusBar'
import { TreeRow } from './TreeRow'
import type { RepositoryWorkspace } from '../hooks/useRepositoryWorkspace'
import type { EditorStatusBarState } from '../status-bar'
import type { RepositoryRef } from '../../../shared/types'

export function WorkspaceView(workspace: RepositoryWorkspace): React.JSX.Element {
  const {
    repository,
    expandedPaths,
    preview,
    loading,
    previewLoading,
    error,
    isEditing,
    canEditPreview,
    draftContent,
    hasUnsavedChanges,
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
    checkoutBranch,
    openBranchWorktree,
    openRepositoryPreview,
    openBreadcrumbPath,
    selectPreviewPath,
    startEditing,
    cancelEditing,
    updateDraftContent,
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
  const branchPickerRef = useRef<HTMLDivElement | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchCount, setSearchMatchCount] = useState(0)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const [pdfPageCount, setPdfPageCount] = useState<{ path: string; count: number | undefined }>()
  const [editorStatus, setEditorStatus] = useState<EditorStatusBarState | undefined>()
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false)
  const [branchPickerTab, setBranchPickerTab] = useState<'branches' | 'remotes'>('branches')
  const [branchQuery, setBranchQuery] = useState('')
  const [branchActionRef, setBranchActionRef] = useState<string | undefined>()
  const selectedBranchAction = repository?.refs.find((ref) => ref.name === branchActionRef)
  const primaryWorkspaceBranch =
    repository?.refs.find((ref) => ref.type === 'local' && ref.worktreePath === repository.rootPath)
      ?.name ??
    repository?.branch ??
    'HEAD'
  const branchQueryTerms = branchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const visibleRefs =
    repository?.refs.filter((ref) => {
      if (branchQueryTerms.length === 0) return true
      const name = ref.name.toLocaleLowerCase()
      return branchQueryTerms.every((term) => name.includes(term))
    }) ?? []
  const localRefs = visibleRefs.filter((ref) => ref.type === 'local')
  const remoteRefs = visibleRefs.filter((ref) => ref.type === 'remote')
  const displayedBranchRefs = branchPickerTab === 'branches' ? localRefs : remoteRefs
  const appliedSearchQuery = isSearchOpen ? searchQuery : ''
  const activePdfPath =
    preview?.kind === 'file' && preview.previewType === 'pdf' ? preview.path : undefined
  const activePdfPageCount =
    pdfPageCount && pdfPageCount.path === activePdfPath ? pdfPageCount.count : undefined
  const editorStatusWithFileMetadata =
    editorStatus && preview?.kind === 'file'
      ? {
          ...editorStatus,
          encoding: preview.encoding ?? editorStatus.encoding,
          modifiedAt: preview.modifiedAt,
          lastChange: preview.lastChange
        }
      : editorStatus
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
  const handlePdfPageCountChange = useCallback(
    (count: number | undefined): void => {
      if (!activePdfPath) return
      setPdfPageCount({ path: activePdfPath, count })
    },
    [activePdfPath]
  )
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

  const closeBranchPicker = useCallback((): void => {
    setIsBranchPickerOpen(false)
    setBranchPickerTab('branches')
    setBranchQuery('')
  }, [])

  useEffect(() => {
    if (!isBranchPickerOpen) return

    const pointerdownEvent = 'pointerdown'
    const handlePointerDown = (event: PointerEvent): void => {
      if (!branchPickerRef.current) {
        closeBranchPicker()
        return
      }

      if (branchPickerRef.current.contains(event.target as Node)) return
      closeBranchPicker()
    }

    window.addEventListener(pointerdownEvent, handlePointerDown)
    return () => window.removeEventListener(pointerdownEvent, handlePointerDown)
  }, [closeBranchPicker, isBranchPickerOpen])

  const openBranchActionModal = (refName: string): void => {
    setBranchActionRef(refName)
    closeBranchPicker()
  }

  const handleBranchRefSelect = (ref: RepositoryRef): void => {
    if (ref.current) {
      closeBranchPicker()
      return
    }

    if (ref.worktreePath) {
      closeBranchPicker()
      void openBranchWorktree(ref.name)
      return
    }

    openBranchActionModal(ref.name)
  }

  const closeBranchActionModal = (): void => {
    setBranchActionRef(undefined)
  }

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
            {hasUnsavedChanges && active && (
              <span className="main-tab-dirty" aria-label="Unsaved changes" title="Unsaved" />
            )}
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
        <>
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
                    <div className="titlebar-repository" title={repository.path}>
                      {repositoryLabel}
                    </div>
                  </div>

                  <div className="sidebar-controls">
                    <div className="branch-picker" ref={branchPickerRef}>
                      <button
                        className="branch-pill"
                        type="button"
                        aria-label="Switch branches"
                        aria-expanded={isBranchPickerOpen}
                        disabled={loading}
                        onClick={() => setIsBranchPickerOpen((open) => !open)}
                      >
                        <GitBranch size={15} />
                        <span title={repository.activeRef}>{repository.activeRef}</span>
                        <ChevronDown size={15} />
                      </button>
                      {isBranchPickerOpen && (
                        <div
                          className="branch-picker-popover"
                          role="dialog"
                          aria-label="Switch branches"
                        >
                          <div className="branch-picker-header">
                            <strong>Switch branches</strong>
                            <button
                              type="button"
                              aria-label="Close branch picker"
                              onClick={() => setIsBranchPickerOpen(false)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <label className="branch-picker-search">
                            <Search size={16} />
                            <input
                              value={branchQuery}
                              placeholder="Find a branch..."
                              onChange={(event) => setBranchQuery(event.target.value)}
                            />
                          </label>
                          <div
                            className="branch-picker-tabs"
                            role="tablist"
                            aria-label="Branch refs"
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={branchPickerTab === 'branches'}
                              onClick={() => setBranchPickerTab('branches')}
                            >
                              Branches
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={branchPickerTab === 'remotes'}
                              onClick={() => setBranchPickerTab('remotes')}
                            >
                              Remotes
                            </button>
                          </div>
                          <div className="branch-picker-list">
                            {displayedBranchRefs.map((ref) => (
                              <button
                                className="branch-picker-row"
                                type="button"
                                key={`${ref.type}:${ref.name}`}
                                onClick={() => handleBranchRefSelect(ref)}
                              >
                                <span aria-hidden="true">{ref.current ? '✓' : ''}</span>
                                <span title={ref.name}>{ref.name}</span>
                                {ref.current && <strong>current</strong>}
                                {!ref.current && ref.worktreePath && <strong>open</strong>}
                              </button>
                            ))}
                            {displayedBranchRefs.length === 0 && (
                              <div className="branch-picker-empty">No branches found</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {selectedBranchAction && (
                      <div
                        className="branch-action-backdrop"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Choose action for ${selectedBranchAction.name}`}
                        onMouseDown={closeBranchActionModal}
                      >
                        <section
                          className="branch-action-modal"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <div className="branch-action-heading">
                            <div>
                              <span>Selected branch</span>
                              <strong title={selectedBranchAction.name}>
                                {selectedBranchAction.name}
                              </strong>
                            </div>
                            <button
                              type="button"
                              aria-label="Close branch action"
                              onClick={closeBranchActionModal}
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <div className="branch-action-options">
                            <button
                              className="branch-action-option"
                              type="button"
                              disabled={loading || selectedBranchAction.type !== 'local'}
                              onClick={() => {
                                const branch = selectedBranchAction.name
                                closeBranchActionModal()
                                void checkoutBranch(branch)
                              }}
                            >
                              <strong>
                                Switch primary workspace from {primaryWorkspaceBranch} to{' '}
                                {selectedBranchAction.name}
                              </strong>
                              <span>
                                Changes the primary repository folder to {selectedBranchAction.name}
                                . Existing worktrees keep their branches.
                              </span>
                            </button>
                            <button
                              className="branch-action-option"
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                const ref = selectedBranchAction.name
                                closeBranchActionModal()
                                void openBranchWorktree(ref)
                              }}
                            >
                              <strong>Create git worktree in .worktrees</strong>
                              <span>
                                Creates or opens an isolated working copy under .worktrees while the
                                current folder keeps its branch.
                              </span>
                            </button>
                          </div>
                          {selectedBranchAction.type !== 'local' && (
                            <p className="branch-action-note">
                              Remote refs can be opened as worktrees. Switching in place requires a
                              local branch first.
                            </p>
                          )}
                          <button
                            className="branch-action-cancel"
                            type="button"
                            onClick={closeBranchActionModal}
                          >
                            Cancel
                          </button>
                        </section>
                      </div>
                    )}
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
                        dirtyPath={hasUnsavedChanges ? selectedPath : undefined}
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
                            {hasUnsavedChanges && isLast && (
                              <span
                                className="breadcrumb-dirty"
                                aria-label="Unsaved changes"
                                title="Unsaved"
                              />
                            )}
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
                {canEditPreview && (
                  <>
                    <button
                      className="path-search-button"
                      type="button"
                      aria-label={isEditing ? 'Show preview' : 'Edit file'}
                      aria-pressed={isEditing}
                      onClick={isEditing ? cancelEditing : startEditing}
                    >
                      {isEditing ? <Eye size={15} /> : <Pencil size={15} />}
                    </button>
                  </>
                )}
              </div>

              <div className="preview-body" ref={previewBodyRef}>
                {previewLoading && (
                  <div className="loading-state">
                    <Loader2 className="spin" size={26} />
                  </div>
                )}
                {!previewLoading && preview && isEditing && preview.kind === 'file' ? (
                  <FileEditor
                    content={draftContent}
                    encoding={preview.encoding}
                    extension={preview.extension}
                    lastChange={preview.lastChange}
                    modifiedAt={preview.modifiedAt}
                    onChange={updateDraftContent}
                    onStatusChange={setEditorStatus}
                  />
                ) : (
                  !previewLoading &&
                  preview && (
                    <PreviewContent
                      pendingAnchor={pendingMarkdownAnchor}
                      preview={preview}
                      searchQuery={appliedSearchQuery}
                      activeSearchIndex={activeSearchIndex}
                      onSearchMatchCountChange={handleSearchMatchCountChange}
                      onPdfPageCountChange={handlePdfPageCountChange}
                      onSelectPath={selectPreviewPath}
                      onOpenMarkdownLinkContextMenu={showMarkdownLinkContextMenu}
                      onMarkdownAnchorHandled={clearPendingMarkdownAnchor}
                    />
                  )
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
              key={`${repository.path}:${repository.rootPath ?? ''}:${repository.source}:${repository.activeRef}`}
              open={isGlobalSearchOpen}
              repository={repository}
              onOpenChange={setIsGlobalSearchOpen}
              onOpenResult={(result) => {
                selectPreviewPath(result.path)
              }}
            />
          </section>
          <StatusBar
            repository={repository}
            preview={preview}
            pdfPageCount={activePdfPageCount}
            editorStatus={isEditing ? editorStatusWithFileMetadata : undefined}
          />
        </>
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
