import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Columns2,
  Eye,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings,
  X
} from 'lucide-react'
import { iconForNode } from '../app-utils'
import { getDirectoryReadmeBreadcrumbSource } from '../breadcrumb-display'
import { getSelectedPreviewSearchText, getSteppedSearchIndex } from '../preview-search'
import { FileEditor } from './FileEditor'
import { GlobalSearchModal } from './GlobalSearchModal'
import { PreviewContent } from './PreviewContent'
import { SettingsDialog } from './SettingsDialog'
import { StatusBar } from './StatusBar'
import { TreeRow } from './TreeRow'
import { applyDraftToPreview, getEditablePreviewTarget } from '../hooks/useRepositoryWorkspace'
import type { RepositoryWorkspace } from '../hooks/useRepositoryWorkspace'
import type { EditorStatusBarState } from '../status-bar'
import type { RepositoryRef } from '../../../shared/types'

type FileViewMode = 'preview' | 'code' | 'split'

const MIN_SPLIT_PANE_WIDTH = 260
const SPLIT_KEYBOARD_STEP = 5

export function WorkspaceView(workspace: RepositoryWorkspace): React.JSX.Element {
  const { t } = useTranslation()
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
    updateDraftContent,
    pendingMarkdownAnchor,
    clearPendingMarkdownAnchor,
    showMarkdownLinkContextMenu,
    settings,
    isSettingsOpen,
    openSettings,
    closeSettings,
    saveSettings,
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
  const [fileViewModeState, setFileViewModeState] = useState<{
    editing: boolean
    mode: FileViewMode
    path?: string
  }>({ editing: false, mode: 'preview' })
  const [pdfPageCount, setPdfPageCount] = useState<{ path: string; count: number | undefined }>()
  const [editorStatus, setEditorStatus] = useState<EditorStatusBarState | undefined>()
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false)
  const [branchPickerTab, setBranchPickerTab] = useState<'branches' | 'remotes'>('branches')
  const [branchQuery, setBranchQuery] = useState('')
  const [branchActionRef, setBranchActionRef] = useState<string | undefined>()
  const [splitEditorPaneWidthPct, setSplitEditorPaneWidthPct] = useState(50)
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
  const editablePreviewTarget = getEditablePreviewTarget(preview)
  const fileViewMode =
    fileViewModeState.path === editablePreviewTarget?.path &&
    fileViewModeState.editing === isEditing
      ? fileViewModeState.mode
      : 'preview'
  const canSplitPreview = Boolean(
    canEditPreview &&
    editablePreviewTarget &&
    ['.md', '.markdown', '.mdx'].includes(editablePreviewTarget.extension.toLocaleLowerCase())
  )
  const effectiveFileViewMode =
    fileViewMode === 'split' && !canSplitPreview
      ? 'code'
      : fileViewMode === 'code' && (!canEditPreview || !isEditing)
        ? 'preview'
        : fileViewMode
  const isEditorMounted = Boolean(editablePreviewTarget && isEditing)
  const showsEditor = Boolean(
    editablePreviewTarget &&
    isEditing &&
    (effectiveFileViewMode === 'code' || effectiveFileViewMode === 'split')
  )
  const showsPreview = Boolean(preview && effectiveFileViewMode !== 'code')
  const previewForDisplay =
    editablePreviewTarget && isEditing ? applyDraftToPreview(preview, draftContent) : preview
  const fileWorkspaceClassName =
    effectiveFileViewMode === 'split' ? 'file-workspace split' : 'file-workspace'
  const splitWorkspaceStyle =
    effectiveFileViewMode === 'split'
      ? ({
          '--split-editor-width': `${splitEditorPaneWidthPct}%`
        } as React.CSSProperties)
      : undefined
  const editorPaneClassName =
    effectiveFileViewMode === 'split' ? 'file-editor-pane split' : 'file-editor-pane'
  const editorStatusWithFileMetadata =
    editorStatus && editablePreviewTarget
      ? {
          ...editorStatus,
          encoding: editablePreviewTarget.encoding ?? editorStatus.encoding,
          modifiedAt: editablePreviewTarget.modifiedAt,
          lastChange: editablePreviewTarget.lastChange
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
  const selectFileViewMode = (mode: FileViewMode): void => {
    if ((mode === 'code' || mode === 'split') && canEditPreview && !isEditing) {
      startEditing()
    }

    setFileViewModeState({
      editing: Boolean(mode !== 'preview'),
      mode,
      path: editablePreviewTarget?.path
    })
  }
  const handleSplitResizerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const workspaceElement = event.currentTarget.parentElement
      if (!workspaceElement) return

      event.preventDefault()

      const resizerElement = event.currentTarget
      const rect = workspaceElement.getBoundingClientRect()
      const dividerWidth = resizerElement.getBoundingClientRect().width
      const maxEditorWidth = rect.width - MIN_SPLIT_PANE_WIDTH - dividerWidth
      if (rect.width <= 0 || maxEditorWidth < MIN_SPLIT_PANE_WIDTH) return

      const updateSplitWidth = (clientX: number): void => {
        const nextWidth = Math.min(
          Math.max(clientX - rect.left, MIN_SPLIT_PANE_WIDTH),
          maxEditorWidth
        )

        setSplitEditorPaneWidthPct((nextWidth / rect.width) * 100)
      }
      const handlePointerMove = (pointerEvent: PointerEvent): void => {
        updateSplitWidth(pointerEvent.clientX)
      }
      const handlePointerUp = (pointerEvent: PointerEvent): void => {
        resizerElement.releasePointerCapture(pointerEvent.pointerId)
        resizerElement.removeEventListener('pointermove', handlePointerMove)
        resizerElement.removeEventListener('pointerup', handlePointerUp)
        resizerElement.removeEventListener('pointercancel', handlePointerUp)
      }

      updateSplitWidth(event.clientX)
      resizerElement.setPointerCapture(event.pointerId)
      resizerElement.addEventListener('pointermove', handlePointerMove)
      resizerElement.addEventListener('pointerup', handlePointerUp)
      resizerElement.addEventListener('pointercancel', handlePointerUp)
    },
    []
  )
  const handleSplitResizerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
      if (direction === 0) return

      event.preventDefault()

      const workspaceElement = event.currentTarget.parentElement
      const rectWidth = workspaceElement?.getBoundingClientRect().width ?? 0
      const dividerWidth = event.currentTarget.getBoundingClientRect().width
      const minWidthPct = rectWidth > 0 ? (MIN_SPLIT_PANE_WIDTH / rectWidth) * 100 : 0
      const maxWidthPct =
        rectWidth > 0 ? ((rectWidth - MIN_SPLIT_PANE_WIDTH - dividerWidth) / rectWidth) * 100 : 100

      setSplitEditorPaneWidthPct((currentWidth) =>
        Math.min(
          Math.max(currentWidth + direction * SPLIT_KEYBOARD_STEP, minWidthPct),
          Math.max(minWidthPct, maxWidthPct)
        )
      )
    },
    []
  )

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
  const previewContentElement =
    showsPreview && previewForDisplay ? (
      <PreviewContent
        pendingAnchor={pendingMarkdownAnchor}
        preview={previewForDisplay}
        searchQuery={appliedSearchQuery}
        activeSearchIndex={activeSearchIndex}
        onSearchMatchCountChange={handleSearchMatchCountChange}
        onPdfPageCountChange={handlePdfPageCountChange}
        onSelectPath={selectPreviewPath}
        onOpenMarkdownLinkContextMenu={showMarkdownLinkContextMenu}
        onMarkdownAnchorHandled={clearPendingMarkdownAnchor}
      />
    ) : undefined

  const fileTabsNav = (
    <nav
      className="main-tabs"
      aria-label={t('app.openTabs')}
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
              <span
                className="main-tab-dirty"
                aria-label={t('app.unsavedChanges')}
                title={t('app.unsaved')}
              />
            )}
            <button
              className="main-tab-close"
              type="button"
              aria-label={t('app.closeTab', { name: tab.name })}
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
          <h2>{t('app.openRepository')}</h2>
          <button
            className="open-button large"
            type="button"
            disabled={loading}
            onClick={openRepository}
          >
            {loading ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
            {t('app.openRepository')}
          </button>
          <button className="open-button secondary" type="button" onClick={openSettings}>
            <Settings size={17} />
            {t('app.settings')}
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
                <aside className="tree-panel" aria-label={t('app.files')}>
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
                        aria-label={t('branch.switchBranches')}
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
                          aria-label={t('branch.switchBranches')}
                        >
                          <div className="branch-picker-header">
                            <strong>{t('branch.switchBranches')}</strong>
                            <button
                              type="button"
                              aria-label={t('branch.closePicker')}
                              onClick={() => setIsBranchPickerOpen(false)}
                            >
                              <X size={15} />
                            </button>
                          </div>
                          <label className="branch-picker-search">
                            <Search size={16} />
                            <input
                              value={branchQuery}
                              placeholder={t('branch.findPlaceholder')}
                              onChange={(event) => setBranchQuery(event.target.value)}
                            />
                          </label>
                          <div
                            className="branch-picker-tabs"
                            role="tablist"
                            aria-label={t('branch.refs')}
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={branchPickerTab === 'branches'}
                              onClick={() => setBranchPickerTab('branches')}
                            >
                              {t('branch.branches')}
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={branchPickerTab === 'remotes'}
                              onClick={() => setBranchPickerTab('remotes')}
                            >
                              {t('branch.remotes')}
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
                                {ref.current && <strong>{t('branch.current')}</strong>}
                                {!ref.current && ref.worktreePath && (
                                  <strong>{t('branch.open')}</strong>
                                )}
                              </button>
                            ))}
                            {displayedBranchRefs.length === 0 && (
                              <div className="branch-picker-empty">{t('branch.empty')}</div>
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
                        aria-label={t('branch.chooseAction', { name: selectedBranchAction.name })}
                        onMouseDown={closeBranchActionModal}
                      >
                        <section
                          className="branch-action-modal"
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <div className="branch-action-heading">
                            <div>
                              <span>{t('branch.selectedBranch')}</span>
                              <strong title={selectedBranchAction.name}>
                                {selectedBranchAction.name}
                              </strong>
                            </div>
                            <button
                              type="button"
                              aria-label={t('branch.closeAction')}
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
                                {t('branch.switchPrimary', {
                                  from: primaryWorkspaceBranch,
                                  to: selectedBranchAction.name
                                })}
                              </strong>
                              <span>
                                {t('branch.switchPrimaryDescription', {
                                  branch: selectedBranchAction.name
                                })}
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
                              <strong>{t('branch.createWorktree')}</strong>
                              <span>{t('branch.createWorktreeDescription')}</span>
                            </button>
                          </div>
                          {selectedBranchAction.type !== 'local' && (
                            <p className="branch-action-note">{t('branch.remoteNote')}</p>
                          )}
                          <button
                            className="branch-action-cancel"
                            type="button"
                            onClick={closeBranchActionModal}
                          >
                            {t('common.cancel')}
                          </button>
                        </section>
                      </div>
                    )}
                    <button
                      className="sidebar-control-button"
                      type="button"
                      aria-label={t('app.add')}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      className="sidebar-control-button"
                      type="button"
                      aria-label={t('app.searchFiles')}
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
                  aria-label={t('preview.resizePanels')}
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
                    aria-label={isSidebarOpen ? t('app.hideFiles') : t('app.showFiles')}
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
                  <button
                    className="titlebar-icon-button"
                    type="button"
                    aria-label={t('app.settings')}
                    aria-expanded={isSettingsOpen}
                    onClick={openSettings}
                  >
                    <Settings size={17} />
                  </button>
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
                      aria-label={t('app.showingPath', { path: directoryReadmeSource.path })}
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
                                aria-label={t('app.unsavedChanges')}
                                title={t('app.unsaved')}
                              />
                            )}
                            {directoryReadmeSource && (
                              <span
                                className="breadcrumb-source"
                                title={directoryReadmeSource.path}
                                aria-label={t('app.showingPath', {
                                  path: directoryReadmeSource.path
                                })}
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
                {(preview?.kind === 'file' || editablePreviewTarget) && (
                  <div className="file-view-tabs" role="tablist" aria-label={t('fileView.label')}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveFileViewMode === 'preview'}
                      onClick={() => selectFileViewMode('preview')}
                    >
                      <Eye size={15} />
                      {t('fileView.preview')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveFileViewMode === 'code'}
                      disabled={!canEditPreview}
                      onClick={() => selectFileViewMode('code')}
                    >
                      <Pencil size={15} />
                      {t('fileView.code')}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveFileViewMode === 'split'}
                      disabled={!canSplitPreview}
                      onClick={() => selectFileViewMode('split')}
                    >
                      <Columns2 size={15} />
                      {t('fileView.split')}
                    </button>
                  </div>
                )}
              </div>

              <div className="preview-body" ref={previewBodyRef}>
                {previewLoading && (
                  <div className="loading-state">
                    <Loader2 className="spin" size={26} />
                  </div>
                )}
                {!previewLoading && preview && (
                  <div className={fileWorkspaceClassName} style={splitWorkspaceStyle}>
                    {isEditorMounted && editablePreviewTarget && (
                      <div className={editorPaneClassName} hidden={!showsEditor}>
                        <FileEditor
                          content={draftContent}
                          encoding={editablePreviewTarget.encoding}
                          extension={editablePreviewTarget.extension}
                          lastChange={editablePreviewTarget.lastChange}
                          modifiedAt={editablePreviewTarget.modifiedAt}
                          settings={settings}
                          onChange={updateDraftContent}
                          onStatusChange={setEditorStatus}
                        />
                      </div>
                    )}
                    {effectiveFileViewMode === 'split' && showsEditor && showsPreview && (
                      <div
                        aria-label={t('preview.resizeEditorPreview')}
                        aria-orientation="vertical"
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={Math.round(splitEditorPaneWidthPct)}
                        className="file-split-resizer"
                        role="separator"
                        tabIndex={0}
                        onKeyDown={handleSplitResizerKeyDown}
                        onPointerDown={handleSplitResizerPointerDown}
                      />
                    )}
                    {effectiveFileViewMode === 'split' && previewContentElement ? (
                      <div className="file-preview-pane">{previewContentElement}</div>
                    ) : (
                      previewContentElement
                    )}
                  </div>
                )}
              </div>
              {isSearchOpen && (
                <form
                  className="preview-search-popover"
                  role="search"
                  aria-label={t('search.currentTab')}
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
                    aria-label={t('search.currentTab')}
                    value={searchQuery}
                    placeholder={t('search.find')}
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
                    aria-label={t('search.previousMatch')}
                    disabled={searchMatchCount === 0}
                    onClick={() => stepSearchMatch(-1)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    className="preview-search-button"
                    type="button"
                    aria-label={t('search.nextMatch')}
                    disabled={searchMatchCount === 0}
                    onClick={() => stepSearchMatch(1)}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    className="preview-search-button"
                    type="button"
                    aria-label={t('search.closeFind')}
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
            editorStatus={showsEditor ? editorStatusWithFileMetadata : undefined}
            language={settings.language}
          />
        </>
      )}
      {isSettingsOpen && (
        <SettingsDialog settings={settings} onClose={closeSettings} onSave={saveSettings} />
      )}
    </main>
  )
}

function TitlebarWindowControls(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="titlebar-window-controls">
      <button
        className="window-control close"
        type="button"
        aria-label={t('app.closeWindow')}
        onClick={() => window.api.controlWindow('close')}
      />
      <button
        className="window-control minimize"
        type="button"
        aria-label={t('app.minimizeWindow')}
        onClick={() => window.api.controlWindow('minimize')}
      />
      <button
        className="window-control zoom"
        type="button"
        aria-label={t('app.toggleFullscreen')}
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
  const { t } = useTranslation()

  return (
    <>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label={t('app.back')}
        disabled={!canNavigateBack}
        onClick={() => void onNavigate(-1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label={t('app.forward')}
        disabled={!canNavigateForward}
        onClick={() => void onNavigate(1)}
      >
        <ChevronRight size={16} />
      </button>
    </>
  )
}
