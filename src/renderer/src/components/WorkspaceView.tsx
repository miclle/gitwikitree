import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import { Code2, Columns2, Eye, GitCommit, Loader2, Pencil, Plus } from 'lucide-react'
import { getDirectoryReadmeBreadcrumbSource } from '../breadcrumb-display'
import { useGitBlame } from '../hooks/useGitBlame'
import { BranchControls } from './BranchControls'
import { BlamePreview } from './BlamePreview'
import { FileTabsNav } from './FileTabsNav'
import { FileEditor } from './FileEditor'
import { GlobalSearchModal } from './GlobalSearchModal'
import { PreviewContent } from './PreviewContent'
import { PreviewSearchPopover } from './PreviewSearchPopover'
import { SettingsDialog } from './SettingsDialog'
import { StatusBar } from './StatusBar'
import { TreeRow } from './TreeRow'
import { HistoryButtons, TitlebarWindowControls } from './WindowControls'
import { useFileViewMode } from '../hooks/useFileViewMode'
import { usePreviewSearchControls } from '../hooks/usePreviewSearchControls'
import { usePreviewStatusMetadata } from '../hooks/usePreviewStatusMetadata'
import { useSplitEditorResize } from '../hooks/useSplitEditorResize'
import { useSplitScrollSync } from '../hooks/useSplitScrollSync'
import type { RepositoryWorkspace } from '../hooks/useRepositoryWorkspace'

export function WorkspaceView(workspace: RepositoryWorkspace): React.JSX.Element {
  const { t } = useTranslation()
  const {
    repositoryState,
    previewState,
    editingState,
    layoutState,
    tabState,
    navigationActions,
    settingsState
  } = workspace
  const {
    repository,
    expandedPaths,
    renamingPath,
    loading,
    error,
    selectedPath,
    breadcrumbParts,
    repositoryLabel
  } = repositoryState
  const {
    preview,
    previewLoading,
    pendingMarkdownAnchor,
    clearPendingMarkdownAnchor,
    showMarkdownLinkContextMenu
  } = previewState
  const {
    isEditing,
    canEditPreview,
    draftContent,
    hasUnsavedChanges,
    startEditing,
    updateDraftContent
  } = editingState
  const { isSidebarOpen, setIsSidebarOpen, sidebarWidth, isResizing, startResizing } = layoutState
  const {
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
    canNavigateBack,
    canNavigateForward
  } = tabState
  const {
    openRepository,
    handleSelect,
    toggleDirectory,
    showTreeItemContextMenu,
    renameTreeItem,
    cancelRenameTreeItem,
    showBreadcrumbContextMenu: openBreadcrumbContextMenu,
    navigateActiveTabHistory,
    checkoutBranch,
    openBranchWorktree,
    openRepositoryPreview,
    openBreadcrumbPath,
    selectPreviewPath
  } = navigationActions
  const { settings, isSettingsOpen, closeSettings, saveSettings } = settingsState
  const directoryReadmeSource = getDirectoryReadmeBreadcrumbSource(preview)
  const {
    searchInputRef,
    previewBodyRef,
    isSearchOpen,
    searchQuery,
    appliedSearchQuery,
    searchMatchCount,
    activeSearchIndex,
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    setSearchQuery,
    setActiveSearchIndex,
    closePreviewSearch,
    stepSearchMatch,
    handleSearchMatchCountChange
  } = usePreviewSearchControls()
  const {
    editablePreviewTarget,
    effectiveFileViewMode,
    canSplitPreview,
    isEditorMounted,
    showsEditor,
    showsPreview,
    previewForDisplay,
    fileWorkspaceClassName,
    editorPaneClassName,
    selectFileViewMode
  } = useFileViewMode({
    preview,
    draftContent,
    isEditing,
    canEditPreview,
    startEditing
  })
  const {
    splitEditorPaneWidthPct,
    splitWorkspaceStyle,
    handleSplitResizerPointerDown,
    handleSplitResizerKeyDown
  } = useSplitEditorResize(effectiveFileViewMode === 'split')
  const splitScrollSyncRef = useSplitScrollSync(effectiveFileViewMode === 'split')
  const {
    activePdfPageCount,
    editorStatusForStatusBar,
    setEditorStatus,
    handlePdfPageCountChange
  } = usePreviewStatusMetadata({
    preview,
    editablePreviewTarget,
    showsEditor
  })
  const { blame, blameLoading, blameError } = useGitBlame({
    repository,
    target: editablePreviewTarget,
    active: effectiveFileViewMode === 'blame'
  })
  const showBreadcrumbContextMenu = (event: MouseEvent<HTMLElement>, path: string): void => {
    event.preventDefault()
    void openBreadcrumbContextMenu(path)
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

  return (
    <main className={isResizing ? 'app-shell is-resizing' : 'app-shell'}>
      {!repository ? (
        <>
          <div className="app-titlebar welcome-titlebar">
            <div className="titlebar-main">
              <TitlebarWindowControls />
              <div className="welcome-titlebar-title">{t('app.title')}</div>
            </div>
          </div>
          {error && <div className="error-banner">{error}</div>}
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
          </section>
        </>
      ) : (
        <>
          {error && <div className="error-banner">{error}</div>}
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
                        renamingPath={renamingPath}
                        onSelect={handleSelect}
                        onToggle={toggleDirectory}
                        onOpenContextMenu={showTreeItemContextMenu}
                        onRenameSubmit={renameTreeItem}
                        onRenameCancel={cancelRenameTreeItem}
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
                    <button
                      type="button"
                      role="tab"
                      aria-selected={effectiveFileViewMode === 'blame'}
                      disabled={!editablePreviewTarget}
                      onClick={() => selectFileViewMode('blame')}
                    >
                      <GitCommit size={15} />
                      {t('fileView.blame')}
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
                  <div
                    className={fileWorkspaceClassName}
                    ref={splitScrollSyncRef}
                    style={splitWorkspaceStyle}
                  >
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
                    ) : effectiveFileViewMode === 'blame' ? (
                      blameLoading ? (
                        <div className="loading-state">
                          <Loader2 className="spin" size={26} />
                          <span>{t('preview.loadingBlame')}</span>
                        </div>
                      ) : blameError ? (
                        <div className="unsupported-preview">{t('preview.blameUnavailable')}</div>
                      ) : blame ? (
                        <BlamePreview blame={blame} />
                      ) : undefined
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
            editorStatus={editorStatusForStatusBar}
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
