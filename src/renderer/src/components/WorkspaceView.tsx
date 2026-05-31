import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import { Code2, Columns2, Eye, Loader2, Pencil, Plus, Settings } from 'lucide-react'
import { getDirectoryReadmeBreadcrumbSource } from '../breadcrumb-display'
import { getSelectedPreviewSearchText, getSteppedSearchIndex } from '../preview-search'
import { BranchControls } from './BranchControls'
import { FileTabsNav } from './FileTabsNav'
import { FileEditor } from './FileEditor'
import { GlobalSearchModal } from './GlobalSearchModal'
import { PreviewContent } from './PreviewContent'
import { PreviewSearchPopover } from './PreviewSearchPopover'
import { SettingsDialog } from './SettingsDialog'
import { StatusBar } from './StatusBar'
import { TreeRow } from './TreeRow'
import { HistoryButtons, TitlebarWindowControls } from './WindowControls'
import { applyDraftToPreview, getEditablePreviewTarget } from '../hooks/useRepositoryWorkspace'
import { useSplitEditorResize } from '../hooks/useSplitEditorResize'
import type { RepositoryWorkspace } from '../hooks/useRepositoryWorkspace'
import type { EditorStatusBarState } from '../status-bar'

type FileViewMode = 'preview' | 'code' | 'split'

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
  const {
    splitEditorPaneWidthPct,
    splitWorkspaceStyle,
    handleSplitResizerPointerDown,
    handleSplitResizerKeyDown
  } = useSplitEditorResize(effectiveFileViewMode === 'split')
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

                  <BranchControls
                    repository={repository}
                    loading={loading}
                    isGlobalSearchOpen={isGlobalSearchOpen}
                    onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
                    onCheckoutBranch={checkoutBranch}
                    onOpenBranchWorktree={openBranchWorktree}
                  />

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
                </div>
                <FileTabsNav
                  tabs={openFileTabs}
                  activeTabId={activeFileTabId}
                  hasUnsavedChanges={hasUnsavedChanges}
                  titlebarTabsRef={titlebarTabsRef}
                  tabPopover={tabPopover}
                  tabPopoverStyle={tabPopoverStyle}
                  onShowTabPopover={showTabPopover}
                  onHideTabPopover={hideTabPopover}
                  onTitlebarTabsPointerLeave={handleTitlebarTabsPointerLeave}
                  onSelectTab={selectFileTab}
                  onCloseTab={closeFileTab}
                />
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
                <PreviewSearchPopover
                  inputRef={searchInputRef}
                  query={searchQuery}
                  matchCount={searchMatchCount}
                  activeIndex={activeSearchIndex}
                  onQueryChange={(query) => {
                    setSearchQuery(query)
                    setActiveSearchIndex(-1)
                  }}
                  onStepMatch={stepSearchMatch}
                  onClose={closePreviewSearch}
                />
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
