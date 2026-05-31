/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

async function readWorkspaceView() {
  return readFile(
    new URL('../src/renderer/src/components/WorkspaceView.tsx', import.meta.url),
    'utf8'
  )
}

async function readBranchControls() {
  return readFile(
    new URL('../src/renderer/src/components/BranchControls.tsx', import.meta.url),
    'utf8'
  )
}

async function readFileTabsNav() {
  return readFile(
    new URL('../src/renderer/src/components/FileTabsNav.tsx', import.meta.url),
    'utf8'
  )
}

async function readMainCss() {
  return readFile(new URL('../src/renderer/src/assets/main.css', import.meta.url), 'utf8')
}

async function readRendererIndex() {
  return readFile(new URL('../src/renderer/index.html', import.meta.url), 'utf8')
}

async function readPanelResizeHook() {
  return readFile(new URL('../src/renderer/src/hooks/usePanelResize.ts', import.meta.url), 'utf8')
}

async function readSessionPersistenceHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useSessionPersistence.ts', import.meta.url),
    'utf8'
  )
}

async function readRepositoryWorkspaceHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useRepositoryWorkspace.ts', import.meta.url),
    'utf8'
  )
}

async function readWorkspaceSessionRestore() {
  return readFile(
    new URL('../src/renderer/src/workspace-session-restore.ts', import.meta.url),
    'utf8'
  )
}

async function readWorkspaceEditingHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useWorkspaceEditing.ts', import.meta.url),
    'utf8'
  )
}

async function readRepositoryPreviewLoaderHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useRepositoryPreviewLoader.ts', import.meta.url),
    'utf8'
  )
}

async function readPendingMarkdownAnchorHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/usePendingMarkdownAnchor.ts', import.meta.url),
    'utf8'
  )
}

async function readWorkspaceSettingsHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useWorkspaceSettings.ts', import.meta.url),
    'utf8'
  )
}

async function readHomeFileDirectoryPreviewReloadHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useHomeFileDirectoryPreviewReload.ts', import.meta.url),
    'utf8'
  )
}

async function readPreviewImageLightboxHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/usePreviewImageLightbox.ts', import.meta.url),
    'utf8'
  )
}

async function readSplitEditorResizeHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useSplitEditorResize.ts', import.meta.url),
    'utf8'
  )
}

async function readPreviewSearchControlsHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/usePreviewSearchControls.ts', import.meta.url),
    'utf8'
  )
}

async function readFileViewModeHook() {
  return readFile(new URL('../src/renderer/src/hooks/useFileViewMode.ts', import.meta.url), 'utf8')
}

async function readPreviewStatusMetadataHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/usePreviewStatusMetadata.ts', import.meta.url),
    'utf8'
  )
}

async function readPreviewContent() {
  return readFile(
    new URL('../src/renderer/src/components/PreviewContent.tsx', import.meta.url),
    'utf8'
  )
}

async function readMarkdownPreview() {
  return readFile(
    new URL('../src/renderer/src/components/MarkdownPreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readCodePreview() {
  return readFile(
    new URL('../src/renderer/src/components/CodePreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readDirectoryListPreview() {
  return readFile(
    new URL('../src/renderer/src/components/DirectoryListPreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readHtmlPreview() {
  return readFile(
    new URL('../src/renderer/src/components/HtmlPreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readImagePreview() {
  return readFile(
    new URL('../src/renderer/src/components/ImagePreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readUnsupportedPreview() {
  return readFile(
    new URL('../src/renderer/src/components/UnsupportedPreview.tsx', import.meta.url),
    'utf8'
  )
}

async function readPdfPreview() {
  return readFile(new URL('../src/renderer/src/components/PdfPreview.tsx', import.meta.url), 'utf8')
}

async function readImageLightbox() {
  return readFile(
    new URL('../src/renderer/src/components/ImageLightbox.tsx', import.meta.url),
    'utf8'
  )
}

async function readFileEditor() {
  return readFile(new URL('../src/renderer/src/components/FileEditor.tsx', import.meta.url), 'utf8')
}

async function readSettingsDialog() {
  return readFile(
    new URL('../src/renderer/src/components/SettingsDialog.tsx', import.meta.url),
    'utf8'
  )
}

async function readTreeRow() {
  return readFile(new URL('../src/renderer/src/components/TreeRow.tsx', import.meta.url), 'utf8')
}

test('preview titlebar places file tabs in the titlebar row', async () => {
  const source = await readWorkspaceView()
  const tabsSource = await readFileTabsNav()

  assert.match(
    source,
    /<div className="main-titlebar">[\s\S]*<FileTabsNav[\s\S]*<\/div>/,
    'preview titlebar should render the file tab strip inside the titlebar'
  )
  assert.match(
    tabsSource,
    /<nav[\s\S]*className="main-tabs"[\s\S]*aria-label=\{t\('app\.openTabs'\)\}/,
    'file tab strip should keep the main tabs navigation markup in its focused component'
  )
})

test('renderer content security policy allows remote markdown images', async () => {
  const source = await readRendererIndex()

  assert.match(
    source,
    /img-src[^"]*'self'[^"]*data:[^"]*https:[^"]*http:/,
    'Markdown badge images served over HTTP or HTTPS should not be blocked by the renderer CSP'
  )
})

test('preview titlebar places sidebar and history controls before the tab strip', async () => {
  const source = await readWorkspaceView()
  const titlebarActions = source.match(
    /<div className="main-titlebar-actions">([\s\S]*?)<\/div>\n\s*<FileTabsNav/
  )

  assert.match(
    source,
    /<div className="main-titlebar">[\s\S]*<div className="main-titlebar-actions">[\s\S]*aria-label=\{isSidebarOpen \? t\('app\.hideFiles'\) : t\('app\.showFiles'\)\}[\s\S]*<HistoryButtons[\s\S]*<FileTabsNav/,
    'preview titlebar should place sidebar and history controls before all tabs'
  )
  assert.ok(titlebarActions, 'preview titlebar actions should exist')
  assert.doesNotMatch(
    titlebarActions[1],
    /app\.settings|openSettings/,
    'preview titlebar actions should not include a settings button'
  )
})

test('collapsed sidebar omits the repository label from the tab bar', async () => {
  const source = await readWorkspaceView()
  const collapsedTitlebar = source.match(/<div className="main-titlebar">([\s\S]*?)<FileTabsNav/)

  assert.ok(collapsedTitlebar, 'preview titlebar should exist')
  assert.doesNotMatch(
    collapsedTitlebar[1],
    /titlebar-repository/,
    'preview titlebar should match Notion by leaving the repository label out of the tab bar'
  )
})

test('sidebar repository label exposes the local workspace path on hover', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /<div className="titlebar-repository" title=\{repository\.path\}>/,
    'sidebar repository label should keep the visible label concise and expose the full path as hover text'
  )
})

test('preview titlebar keeps preview controls tight before tabs', async () => {
  const css = await readMainCss()

  assert.match(
    css,
    /\.main-titlebar-actions\s*\{[\s\S]*?flex:\s*0 0 auto;[\s\S]*?gap:\s*0;/,
    'preview titlebar actions should stay tight before the tab strip'
  )
})

test('settings dialog applies changes immediately without a save action', async () => {
  const source = await readSettingsDialog()
  const settingsHook = await readWorkspaceSettingsHook()
  const homeFilePreviewReloadHook = await readHomeFileDirectoryPreviewReloadHook()

  assert.doesNotMatch(source, /onSubmit=|type="submit"|>\s*Save\s*</)
  assert.doesNotMatch(source, /settings-actions|>\s*Done\s*</)
  assert.match(
    source,
    /addEventListener\('keydown', handleKeyDown\)[\s\S]*removeEventListener\('keydown', handleKeyDown\)/,
    'settings dialog should close from Escape and clean up its key listener'
  )
  assert.match(
    source,
    /if \(event\.key === 'Escape'\) \{[\s\S]*onClose\(\)/,
    'settings dialog should close when Escape is pressed'
  )
  assert.match(
    source,
    /const applySetting = <Key extends keyof AppSettings>[\s\S]*void onSave\(\{ \[key\]: value \}/,
    'settings controls should persist individual changes from their onChange handlers'
  )
  assert.match(
    source,
    /onChange=\{\(event\) =>[\s\S]*applySetting\('appearance'/,
    'appearance changes should apply immediately'
  )
  assert.match(
    source,
    /onChange=\{\(event\) =>[\s\S]*applyHomeFileNames/,
    'home file candidate edits should apply without an extra save click'
  )
  const saveSettingsBlock = settingsHook.match(
    /const saveSettings = useCallback\([\s\S]*?\n {2}\)\n\n {2}return/
  )
  assert.ok(saveSettingsBlock, 'settings hook should expose a saveSettings callback')
  assert.doesNotMatch(
    saveSettingsBlock[0],
    /setIsSettingsOpen\(false\)/,
    'saving settings should not close the modal after each immediate change'
  )
  assert.match(
    settingsHook,
    /onHomeFileNamesChange\(\)/,
    'home file candidate edits should notify the workspace after settings persist'
  )
  assert.match(
    homeFilePreviewReloadHook,
    /homeFilePreviewReloadTimeoutRef = useRef<number \| undefined>\(undefined\)/,
    'home file candidate edits should use a debounced directory preview reload'
  )
  assert.doesNotMatch(
    saveSettingsBlock[0],
    /reloadCurrentRepository|loadRepository/,
    'home file candidate edits should not reload the repository or affect file previews'
  )
  assert.match(
    homeFilePreviewReloadHook,
    /if \(preview\?\.kind !== 'directory'\) return[\s\S]*homeFilePreviewReloadTimeoutRef\.current = window\.setTimeout\(\(\) => \{[\s\S]*void loadPreview\(directoryPath\)/,
    'home file candidate edits should only coalesce reloads for the current directory preview'
  )
  assert.match(
    homeFilePreviewReloadHook,
    /if \(preview\?\.kind === 'directory' && preview\.path === selectedPath\) return[\s\S]*clearHomeFileDirectoryPreviewReload\(\)/,
    'pending home file preview reloads should be canceled after navigating away from the directory'
  )
})

test('repository preview loading state lives in a focused hook', async () => {
  const workspaceHook = await readRepositoryWorkspaceHook()
  const previewLoaderHook = await readRepositoryPreviewLoaderHook()

  assert.match(
    workspaceHook,
    /useRepositoryPreviewLoader\(repository\)/,
    'repository workspace should delegate preview loading state to a focused hook'
  )
  assert.match(
    previewLoaderHook,
    /const \[preview, setPreview\] = useState<PreviewPayload \| undefined>\(\)/,
    'preview loader should own the active preview payload'
  )
  assert.match(
    previewLoaderHook,
    /const \[previewLoading, setPreviewLoading\] = useState\(false\)/,
    'preview loader should own preview loading state'
  )
  assert.match(
    previewLoaderHook,
    /const \[error, setError\] = useState<string \| undefined>\(\)/,
    'preview loader should keep preview load errors with the loading flow'
  )
  assert.match(
    previewLoaderHook,
    /window\.api\.previewPath\(repo\.path, path, \{[\s\S]*source: repo\.source,[\s\S]*rootPath: repo\.rootPath/,
    'preview loader should preserve repository context while loading previews'
  )
  assert.doesNotMatch(
    workspaceHook,
    /const \[previewLoading, setPreviewLoading\] = useState\(false\)/,
    'repository workspace should not duplicate preview loading state'
  )
})

test('markdown anchor navigation state lives in a focused hook', async () => {
  const workspaceHook = await readRepositoryWorkspaceHook()
  const pendingAnchorHook = await readPendingMarkdownAnchorHook()

  assert.match(
    workspaceHook,
    /usePendingMarkdownAnchor\(\)/,
    'repository workspace should delegate pending Markdown anchor state to a focused hook'
  )
  assert.match(
    pendingAnchorHook,
    /const nextAnchorToken = useRef\(0\)/,
    'pending anchor hook should own monotonic anchor tokens'
  )
  assert.match(
    pendingAnchorHook,
    /queuePendingMarkdownAnchor[\s\S]*setPendingMarkdownAnchor\(\{[\s\S]*path,[\s\S]*hash,[\s\S]*token: nextAnchorToken\.current/,
    'pending anchor hook should queue target path, hash, and token together'
  )
  assert.match(
    pendingAnchorHook,
    /clearPendingMarkdownAnchor[\s\S]*current\?\.token === token \? undefined : current/,
    'pending anchor hook should only clear the handled anchor token'
  )
  assert.doesNotMatch(
    workspaceHook,
    /nextAnchorToken/,
    'repository workspace should not own anchor token state'
  )
})

test('dark appearance uses theme variables for shell chrome and settings controls', async () => {
  const css = await readMainCss()

  assert.match(
    css,
    /:root\[data-app-appearance='dark'\]\s*\{[\s\S]*--chrome-bg:[\s\S]*--tab-active-bg:[\s\S]*--control-bg:/,
    'dark mode should define dedicated chrome, tab, and control variables'
  )
  assert.match(
    css,
    /\.tree-panel\s*\{[\s\S]*background:\s*var\(--sidebar-bg\);/,
    'sidebar should not keep the light theme background in dark mode'
  )
  assert.match(
    css,
    /\.main-tab\.active\s*\{[\s\S]*color:\s*var\(--tab-active-text\);[\s\S]*background:\s*var\(--tab-active-bg\);/,
    'active tabs should use theme variables'
  )
  assert.match(
    css,
    /\.breadcrumb strong\s*\{[\s\S]*color:\s*var\(--text\);/,
    'breadcrumb current item should be readable in dark mode'
  )
  assert.match(
    css,
    /\.settings-section\s*\{[\s\S]*border:\s*1px solid var\(--border-muted\);[\s\S]*background:\s*var\(--settings-section-bg\);/,
    'settings sections should be visually grouped with theme-aware surfaces'
  )
  assert.match(
    css,
    /\.settings-control\s*\{[\s\S]*border:\s*1px solid var\(--control-border\);[\s\S]*background:\s*var\(--control-bg\);/,
    'settings form controls should use the same theme-aware control surface as the app chrome'
  )
  assert.match(
    css,
    /\.settings-control\s*\{[^}]*min-height:\s*32px;[^}]*border-radius:\s*8px;/,
    'settings controls should match the compact desktop control density'
  )
  assert.match(
    css,
    /select\.settings-control\s*\{[^}]*appearance:\s*none;[^}]*background-image:\s*url\("data:image\/svg\+xml,/,
    'settings selects should use the app-styled chevron instead of the native platform control'
  )
  assert.match(
    css,
    /select\.settings-control\s*\{[^}]*padding:\s*0 34px 0 12px;/,
    'settings selects should reserve the same compact trailing space as app controls'
  )
  const markdownCodeBlock = css.match(/\.markdown-body pre code\s*\{[^}]*\}/)
  assert.ok(markdownCodeBlock, 'markdown code block rule should exist')
  assert.match(
    markdownCodeBlock[0],
    /color:\s*var\(--text\);/,
    'markdown code block text should stay readable in dark mode'
  )
  assert.match(
    css,
    /--table-bg:[\s\S]*--table-header-bg:[\s\S]*--table-row-alt-bg:[\s\S]*--table-border:[\s\S]*--table-text:/,
    'markdown table surfaces should use theme variables'
  )
  assert.match(
    css,
    /\.markdown-body th,\s*\.markdown-body td\s*\{[^}]*color:\s*var\(--table-text\);[^}]*background:\s*var\(--table-bg\);/,
    'markdown table cells should not inherit light table colors in dark mode'
  )
  assert.match(
    css,
    /:root\[data-app-appearance='dark'\] \.markdown-body th,[\s\S]*:root\[data-app-appearance='dark'\] \.markdown-body td\s*\{[^}]*color:\s*var\(--table-text\) !important;[^}]*background:\s*var\(--table-bg\) !important;/,
    'dark mode should override copied HTML table inline light colors'
  )
})

test('breadcrumb links expose project context menus', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /onContextMenu=\{\(event\) => showBreadcrumbContextMenu\(event, ''\)\}/,
    'repository breadcrumb should expose the app path context menu'
  )
  assert.match(
    source,
    /onContextMenu=\{\(event\) => showBreadcrumbContextMenu\(event, path\)\}/,
    'ancestor breadcrumb links should expose the app path context menu'
  )
})

test('workspace passes breadcrumb context menu handler from the hook', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /showBreadcrumbContextMenu: openBreadcrumbContextMenu,/,
    'workspace should read the breadcrumb context menu handler from workspace state'
  )
})

test('breadcrumb labels expose full text as hover titles', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /<button[\s\S]*?title=\{repository\.name\}[\s\S]*?onClick=\{openRepositoryPreview\}/,
    'repository breadcrumb should expose its full name as a title'
  )
  assert.match(
    source,
    /<strong title=\{part\}>\{part\}<\/strong>/,
    'current breadcrumb should expose the full segment as a title'
  )
  assert.match(
    source,
    /<button[\s\S]*?title=\{part\}[\s\S]*?onClick=\{\(\) => openBreadcrumbPath\(path\)\}/,
    'ancestor breadcrumb links should expose the full segment as a title'
  )
})

test('breadcrumb items stay on one line in narrow windows', async () => {
  const css = await readMainCss()

  assert.match(
    css,
    /\.breadcrumb\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?white-space:\s*nowrap;/,
    'breadcrumb row should clip instead of wrapping when the path is wider than the window'
  )
  assert.match(
    css,
    /\.breadcrumb button,\s*\.breadcrumb strong\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?text-overflow:\s*ellipsis;[\s\S]*?white-space:\s*nowrap;/,
    'breadcrumb labels should truncate on a single line'
  )
  assert.match(
    css,
    /\.breadcrumb > span\s*\{[\s\S]*?white-space:\s*nowrap;/,
    'breadcrumb item containers should not let labels wrap internally'
  )
})

test('current tab search command refocuses the find input even when already open', async () => {
  const source = await readPreviewSearchControlsHook()

  assert.match(
    source,
    /const \[searchFocusRequest, setSearchFocusRequest\] = useState\(0\)/,
    'search should track focus requests separately from open state'
  )
  assert.match(
    source,
    /setSearchFocusRequest\(\(request\) => request \+ 1\)/,
    'opening search should request focus even when the popover is already open'
  )
  assert.match(
    source,
    /\}, \[isSearchOpen, searchFocusRequest\]\)/,
    'search focus effect should rerun for repeated find commands'
  )
})

test('current tab search is available from the app menu event', async () => {
  const source = await readPreviewSearchControlsHook()

  assert.match(
    source,
    /window\.api\.onOpenCurrentTabSearch\(openPreviewSearch\)/,
    'workspace should subscribe to the current-tab search app menu command'
  )
})

test('pathbar does not expose a separate current-tab search button', async () => {
  const source = await readWorkspaceView()

  assert.doesNotMatch(
    source,
    /<button[\s\S]*?aria-label="Find in current tab"[\s\S]*?onClick=\{openPreviewSearch\}/,
    'current-tab search should stay in the app menu and keyboard shortcut, not the pathbar'
  )
})

test('file editor uses a visible selection highlight', async () => {
  const css = await readMainCss()

  assert.match(
    css,
    /\.file-editor\s+\.cm-selectionLayer\s*\{[\s\S]*z-index:\s*50\s*!important;[\s\S]*pointer-events:\s*none;/,
    'CodeMirror drawn selections need to sit above match decorations without intercepting editor input'
  )
  assert.match(
    css,
    /\.file-editor\s+\.cm-selectionBackground[^{]*\{[\s\S]*background:\s*rgba\(9,\s*105,\s*218,\s*0\.34\)\s*!important;/,
    'CodeMirror selections need an explicit high-contrast background in the app theme'
  )
  assert.match(
    css,
    /\.file-editor\s+\.cm-selectionBackground[^{]*\{[\s\S]*box-shadow:\s*inset 0 0 0 1px rgba\(9,\s*105,\s*218,\s*0\.58\);/,
    'CodeMirror selections need a visible edge when multiple short ranges are selected'
  )
  assert.match(
    css,
    /\.file-editor\s+\.cm-content\s*::selection[^{]*\{[\s\S]*background:\s*rgba\(9,\s*105,\s*218,\s*0\.34\)\s*!important;/,
    'native text selection inside CodeMirror should match the visible editor selection color'
  )
})

test('file editing relies on keyboard save and marks dirty file names', async () => {
  const source = await readWorkspaceView()
  const css = await readMainCss()

  assert.doesNotMatch(
    source,
    /aria-label="Save file"/,
    'editing toolbar should not render a dedicated save button'
  )
  assert.match(
    source,
    /hasUnsavedChanges && isLast[\s\S]*className="breadcrumb-dirty"/,
    'the current breadcrumb file name should show a dirty indicator for unsaved edits'
  )
  assert.match(
    css,
    /\.breadcrumb-dirty\s*\{[\s\S]*border-radius:\s*50%;[\s\S]*background:\s*#9a6700;/,
    'breadcrumb dirty indicator should use the same compact dot treatment as tabs'
  )
})

test('file view modes expose preview, code, and split editing without discarding drafts', async () => {
  const source = await readWorkspaceView()
  const fileViewModeHook = await readFileViewModeHook()
  const css = await readMainCss()

  assert.match(
    fileViewModeHook,
    /const \[fileViewModeState, setFileViewModeState\] = useState<FileViewModeState>\(\{[\s\S]*editing: false,[\s\S]*mode: 'preview'[\s\S]*\}\)/,
    'file view controls should keep a simple GitHub-like mode scoped to the active edit session'
  )
  assert.match(
    source,
    /role="tablist"[\s\S]*aria-label=\{t\('fileView\.label'\)\}[\s\S]*t\('fileView\.preview'\)[\s\S]*t\('fileView\.code'\)[\s\S]*t\('fileView\.split'\)/,
    'file view controls should present preview, code, and split as one obvious choice'
  )
  assert.match(
    fileViewModeHook,
    /previewForDisplay[\s\S]*applyDraftToPreview\(preview,\s*draftContent\)/,
    'live Markdown preview should render the current draft instead of the last saved file'
  )
  assert.match(
    source,
    /className=\{fileWorkspaceClassName\}[\s\S]*<FileEditor[\s\S]*className="file-preview-pane"[\s\S]*\{previewContentElement\}/,
    'split mode should show the editor and preview side by side'
  )
  assert.match(
    css,
    /\.file-workspace\.split\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*var\(--split-editor-width,\s*50%\)\)\s*8px\s*minmax\(260px,\s*1fr\);/,
    'split editing should keep both panes usable at desktop widths'
  )
})

test('split editing lets users drag the editor and preview divider', async () => {
  const source = await readWorkspaceView()
  const splitResizeHook = await readSplitEditorResizeHook()
  const css = await readMainCss()

  assert.match(
    splitResizeHook,
    /const \[splitEditorPaneWidthPct, setSplitEditorPaneWidthPct\] = useState\(50\)/,
    'split editing should remember the current editor pane width during the session'
  )
  assert.match(
    splitResizeHook,
    /const handleSplitResizerPointerDown = useCallback[\s\S]*setSplitEditorPaneWidthPct\(\(nextWidth \/ rect\.width\) \* 100\)[\s\S]*setPointerCapture\(event\.pointerId\)/,
    'split divider dragging should calculate a clamped percentage from pointer movement'
  )
  assert.match(
    splitResizeHook,
    /const splitWorkspaceStyle =[\s\S]*'--split-editor-width': `\$\{splitEditorPaneWidthPct\}%`[\s\S]*as CSSProperties/,
    'the split resize hook should expose the remembered width to CSS'
  )
  assert.match(
    source,
    /useSplitEditorResize\(effectiveFileViewMode === 'split'\)[\s\S]*style=\{splitWorkspaceStyle\}/,
    'the split workspace should expose the remembered width to CSS'
  )
  assert.match(
    source,
    /<div[\s\S]*aria-label=\{t\('preview\.resizeEditorPreview'\)\}[\s\S]*aria-orientation="vertical"[\s\S]*className="file-split-resizer"[\s\S]*role="separator"[\s\S]*onPointerDown=\{handleSplitResizerPointerDown\}/,
    'split editing should render an accessible divider between the editor and preview'
  )
  assert.match(
    source,
    /aria-valuemax=\{100\}[\s\S]*aria-valuemin=\{0\}[\s\S]*aria-valuenow=\{Math\.round\(splitEditorPaneWidthPct\)\}[\s\S]*onKeyDown=\{handleSplitResizerKeyDown\}/,
    'keyboard-focusable split dividers should expose their value and handle keyboard resizing'
  )
  assert.match(
    splitResizeHook,
    /const handleSplitResizerKeyDown = useCallback[\s\S]*event\.key === 'ArrowLeft'[\s\S]*event\.key === 'ArrowRight'[\s\S]*MIN_SPLIT_PANE_WIDTH[\s\S]*setSplitEditorPaneWidthPct\(\(currentWidth\) =>[\s\S]*Math\.min\([\s\S]*SPLIT_KEYBOARD_STEP[\s\S]*Math\.max\(/,
    'split divider keyboard resizing should adjust the stored editor width while preserving pane minimums'
  )
  assert.match(
    css,
    /\.file-workspace\.split\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*var\(--split-editor-width,\s*50%\)\)\s*8px\s*minmax\(260px,\s*1fr\);/,
    'split editing should size panes with a draggable divider column and usable minimums'
  )
})

test('directory index previews reuse file editing controls and drafts', async () => {
  const source = await readWorkspaceView()
  const hookSource = await readRepositoryWorkspaceHook()
  const fileViewModeHook = await readFileViewModeHook()

  assert.match(
    hookSource,
    /useWorkspaceEditing\(\{[\s\S]*preview,[\s\S]*repository,/,
    'workspace state should delegate editable file state to a focused editing hook'
  )
  assert.match(
    fileViewModeHook,
    /const editablePreviewTarget = getEditablePreviewTarget\(preview\)/,
    'file view controls should use a shared editable target for files and directory indexes'
  )
  assert.match(
    source,
    /<FileEditor[\s\S]*encoding=\{editablePreviewTarget\.encoding\}[\s\S]*extension=\{editablePreviewTarget\.extension\}[\s\S]*modifiedAt=\{editablePreviewTarget\.modifiedAt\}/,
    'directory index metadata should flow into the same editor as normal files'
  )
  assert.match(
    fileViewModeHook,
    /previewForDisplay[\s\S]*applyDraftToPreview\(preview,\s*draftContent\)/,
    'live directory index Markdown preview should render the current draft'
  )
})

test('stale code mode falls back to preview after editing ends', async () => {
  const source = await readFileViewModeHook()

  assert.match(
    source,
    /fileViewModeState\.editing === isEditing/,
    'file view mode should not reuse code mode from an ended editing session'
  )
  assert.match(
    source,
    /fileViewMode === 'code' && \(!canEditPreview \|\| !isEditing\)[\s\S]*\? 'preview'/,
    'code mode should never hide both editor and preview when the file is no longer being edited'
  )
  assert.match(
    source,
    /setFileViewModeState\(\{[\s\S]*editing: Boolean\(mode !== 'preview'\),[\s\S]*mode,[\s\S]*path: editablePreviewTarget\?\.path[\s\S]*\}\)/,
    'view mode state should record whether it belongs to an active edit session'
  )
})

test('preview content delegates pure preview surfaces to focused components', async () => {
  const previewSource = await readPreviewContent()
  const codePreviewSource = await readCodePreview()
  const directoryListPreviewSource = await readDirectoryListPreview()
  const htmlPreviewSource = await readHtmlPreview()
  const imagePreviewSource = await readImagePreview()
  const unsupportedPreviewSource = await readUnsupportedPreview()

  assert.match(
    previewSource,
    /<DirectoryListPreview[\s\S]*entries=\{preview\.entries\}[\s\S]*rootRef=\{setPreviewSearchRoot\}[\s\S]*onSelectPath=\{onSelectPath\}/,
    'directory list rendering should stay in the focused directory preview component'
  )
  assert.match(
    directoryListPreviewSource,
    /shouldOpenInNewTab\(event\)[\s\S]*className="directory-list"[\s\S]*iconForNode\(entry\)/,
    'directory preview should keep icons and new-tab selection behavior together'
  )
  assert.match(
    previewSource,
    /<CodePreview[\s\S]*content=\{preview\.content\}[\s\S]*extension=\{preview\.extension\}[\s\S]*rootRef=\{setPreviewSearchRoot\}/,
    'source rendering should stay in the focused code preview component'
  )
  assert.match(
    codePreviewSource,
    /aria-label=\{t\('preview\.sourceCode'\)\}[\s\S]*highlightCodeBlock\(content, language\)/,
    'code preview should own syntax highlighting and source accessibility labels'
  )
  assert.match(
    previewSource,
    /<HtmlPreview[\s\S]*content=\{preview\.content\}[\s\S]*rootRef=\{setPreviewSearchRoot\}[\s\S]*onContentReady=\{markPreviewSearchRootReady\}/,
    'html rendering should stay in the focused html preview component'
  )
  assert.match(
    htmlPreviewSource,
    /rootRef\(element\?\.contentDocument\?\.body \?\? null\)[\s\S]*sandbox="allow-same-origin"[\s\S]*onContentReady\(\)/,
    'html preview should own iframe search-root registration and safe sandboxing'
  )
  assert.match(
    previewSource,
    /<SvgPreview[\s\S]*content=\{preview\.content\}[\s\S]*<ImagePreview[\s\S]*src=\{preview\.dataUrl\}/,
    'image and svg rendering should stay in the focused image preview component'
  )
  assert.match(
    imagePreviewSource,
    /className="image-preview"[\s\S]*onPreviewImageClick\(event\.currentTarget, event\)[\s\S]*svgPreviewDataUrl/,
    'image preview should own image preview markup and svg data-url encoding'
  )
  assert.match(
    unsupportedPreviewSource,
    /className="unsupported-preview"[\s\S]*FileText[\s\S]*t\('preview\.fileUnavailable'\)/,
    'unsupported previews should keep their empty-state copy in a focused component'
  )
})

test('file preview keeps the editing CodeMirror instance mounted for undo history', async () => {
  const source = await readWorkspaceView()
  const fileViewModeHook = await readFileViewModeHook()
  const css = await readMainCss()

  assert.match(
    fileViewModeHook,
    /isEditorMounted = Boolean\(\s*editablePreviewTarget && isEditing\s*\)/,
    'file view controls should keep the editor mounted across file view mode changes'
  )
  assert.match(
    source,
    /isEditorMounted && editablePreviewTarget[\s\S]*<div className=\{editorPaneClassName\} hidden=\{!showsEditor\}[\s\S]*<FileEditor/,
    'preview mode should hide, not unmount, the editor pane so CodeMirror keeps undo history'
  )
  assert.match(
    css,
    /\.file-editor-pane\[hidden\]\s*\{[\s\S]*display:\s*none;/,
    'hidden editor panes should not affect the preview layout'
  )
})

test('file editor styles markdown syntax like a document editor', async () => {
  const source = await readFileEditor()
  const css = await readMainCss()

  assert.match(
    source,
    /syntaxHighlighting\(markdownEditorHighlightStyle\)/,
    'Markdown editing should install a dedicated document-style highlight theme'
  )
  assert.match(
    source,
    /tag:\s*tags\.heading1[\s\S]*color:\s*'#0969da'[\s\S]*fontWeight:\s*'700'/,
    'top-level Markdown headings should render as strong blue text while editing'
  )
  assert.match(
    source,
    /tag:\s*tags\.strong[\s\S]*fontWeight:\s*'700'/,
    'bold Markdown spans should carry visual weight in the editor'
  )
  assert.match(
    source,
    /tag:\s*\[tags\.link,\s*tags\.url\][\s\S]*color:\s*'#0a4b8f'/,
    'links and URLs should be blue in Markdown editing mode'
  )
  assert.match(
    css,
    /\.file-editor\s+\.cm-lineNumbers\s+\.cm-gutterElement\s*\{[\s\S]*color:\s*#8c959f;/,
    'line numbers should stay subtle like a document margin'
  )
  assert.match(
    css,
    /\.file-editor\s+\.cm-gutters\s*\{[\s\S]*border-right:\s*0;/,
    'editor gutters should not draw a vertical divider beside the line numbers'
  )
  assert.match(
    css,
    /\.code-line-gutter\s*\{[\s\S]*border-right:\s*0;/,
    'code preview gutters should not draw a vertical divider beside the line numbers'
  )
})

test('global repository search is available from the sidebar and keyboard shortcut', async () => {
  const workspaceSource = await readWorkspaceView()
  const hookSource = await readPreviewSearchControlsHook()

  assert.match(
    hookSource,
    /const \[isGlobalSearchOpen, setIsGlobalSearchOpen\] = useState\(false\)/,
    'search controls should keep global search modal state'
  )
  assert.match(
    hookSource,
    /window\.api\.onOpenGlobalSearch\(\(\) => setIsGlobalSearchOpen\(true\)\)/,
    'search controls should subscribe to the app menu global search command'
  )
  assert.match(
    hookSource,
    /event\.shiftKey[\s\S]*setIsGlobalSearchOpen\(true\)/,
    'Command/Ctrl+Shift+F should open global search'
  )
  assert.match(
    workspaceSource,
    /<GlobalSearchModal[\s\S]*open=\{isGlobalSearchOpen\}/,
    'workspace should render the global search modal'
  )
})

test('global repository search resets when the active branch changes', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /<GlobalSearchModal[\s\S]*key=\{`[^`]*\$\{repository\.activeRef\}[^`]*`\}/,
    'global search state should reset when the same workspace switches branches'
  )
})

test('global repository search opens reveal the selected file in the tree', async () => {
  const source = await readRepositoryWorkspaceHook()

  assert.match(
    source,
    /selectPreviewPath[\s\S]*setExpandedPaths\([\s\S]*\(current\) => new Set\(\[\.\.\.current, '', \.\.\.parentPaths\(resolved\.target\.path\)\]\)[\s\S]*\)[\s\S]*handleSelect\(resolved\.node, \{ openInNewTab \}\)/,
    'opening a search result should expand ancestor folders before selecting the matching file'
  )
})

test('branch selection opens an action modal with explanatory choices', async () => {
  const source = await readBranchControls()
  const css = await readMainCss()

  assert.match(
    source,
    /const \[isBranchPickerOpen, setIsBranchPickerOpen\] = useState\(false\)/,
    'branch selector should use an app-controlled popover instead of a native select'
  )
  assert.match(
    source,
    /const branchPickerRef = useRef<HTMLDivElement \| null>\(null\)/,
    'branch picker should keep a wrapper ref for outside-click handling'
  )
  assert.match(
    source,
    /if \(branchPickerRef\.current\.contains\(event\.target as Node\)\) return[\s\S]*closeBranchPicker\(\)[\s\S]*window\.addEventListener\('pointerdown'/,
    'clicking outside the branch picker should close the popover'
  )
  assert.match(
    source,
    /onClick=\{\(\) => handleBranchRefSelect\(ref\)\}/,
    'choosing a branch row should route through the branch selection handler'
  )
  assert.match(
    source,
    /if \(ref\.worktreePath\)[\s\S]*void onOpenBranchWorktree\(ref\.name\)[\s\S]*return/,
    'refs that already have a worktree should open directly without the action modal'
  )
  assert.match(
    source,
    /primaryWorkspaceBranch[\s\S]*repository\.refs\.find\([\s\S]*ref\.worktreePath === repository\.rootPath/,
    'branch action copy should use the primary workspace branch as the source branch'
  )
  assert.match(
    source,
    /t\('branch\.switchPrimary'[\s\S]*primaryWorkspaceBranch[\s\S]*selectedBranchAction\.name[\s\S]*t\('branch\.switchPrimaryDescription'[\s\S]*selectedBranchAction\.name/,
    'switching should explain that the primary workspace changes while worktrees keep their branches'
  )
  assert.match(
    source,
    /t\('branch\.createWorktree'\)[\s\S]*t\('branch\.createWorktreeDescription'\)/,
    'worktree creation should explain that a separate local working copy is used'
  )
  assert.match(
    css,
    /\.branch-action-backdrop\s*\{[\s\S]*position:\s*fixed;[\s\S]*place-items:\s*center;/,
    'branch actions should be presented as a centered modal'
  )
  assert.match(
    css,
    /\.branch-picker-popover\s*\{[\s\S]*top:\s*88px;[\s\S]*width:\s*min\(320px, calc\(100vw - 24px\)\);/,
    'branch picker popover should be narrower and sit slightly farther below the branch pill'
  )
})

test('restored active file tabs reveal their item in the tree', async () => {
  const source = await readWorkspaceSessionRestore()

  assert.match(
    source,
    /expandedPaths:\s*new Set\(\[[\s\S]*\.\.\.\(session\.expandedPaths\.length \? session\.expandedPaths : \[''\]\),[\s\S]*\.\.\.parentPaths\(nextSelectedPath\)[\s\S]*\]\)/,
    'restoring a window should expand ancestor folders for the active tab'
  )
})

test('current tab search command seeds the query from selected preview text', async () => {
  const workspaceSource = await readWorkspaceView()
  const hookSource = await readPreviewSearchControlsHook()

  assert.match(
    hookSource,
    /const previewBodyRef = useRef<HTMLDivElement \| null>\(null\)/,
    'search controls should keep a ref to the searchable preview content'
  )
  assert.match(
    hookSource,
    /getSelectedPreviewSearchText\(window\.getSelection\(\), previewBodyRef\.current\)/,
    'opening search should read the current selection from the preview content'
  )
  assert.match(
    hookSource,
    /if \(selectedText\) \{[\s\S]*setSearchQuery\(selectedText\)[\s\S]*setActiveSearchIndex\(-1\)[\s\S]*\}/,
    'selected preview text should seed the search query and reset the active match'
  )
  assert.match(
    workspaceSource,
    /<div className="preview-body" ref=\{previewBodyRef\}>/,
    'preview body should be the search selection boundary'
  )
})

test('current tab search closes on Escape even when the find input is blurred', async () => {
  const source = await readPreviewSearchControlsHook()

  assert.match(
    source,
    /if \(event\.key === 'Escape' && isSearchOpen\) \{[\s\S]*event\.preventDefault\(\)[\s\S]*closePreviewSearch\(\)[\s\S]*return[\s\S]*\}/,
    'window key handling should close the search popover when Escape is pressed outside the input'
  )
  assert.match(
    source,
    /\}, \[closePreviewSearch, isSearchOpen, openPreviewSearch\]\)/,
    'global keyboard handler should react to search open state and close callback changes'
  )
})

test('html previews register their iframe body as searchable content', async () => {
  const source = await readHtmlPreview()

  assert.match(
    source,
    /const setHtmlPreviewRoot = \(element: HTMLIFrameElement \| null\): void => \{[\s\S]*rootRef\(element\?\.contentDocument\?\.body \?\? null\)[\s\S]*\}/,
    'html preview should expose the iframe body to the current-tab search highlighter'
  )
  assert.match(
    source,
    /sandbox="allow-same-origin"/,
    'html preview iframe should remain script-disabled while allowing parent-side search access'
  )
  assert.match(
    source,
    /onContentReady\(\)/,
    'html preview load should rerun search once iframe content is available'
  )
})

test('Mermaid previews render diagrams directly without stale processed markers', async () => {
  const source = await readMarkdownPreview()

  assert.match(
    source,
    /await mermaid\.render\(diagramId, source\)/,
    'Mermaid previews should render each diagram directly to SVG'
  )
  assert.doesNotMatch(
    source,
    /mermaid\.run\(/,
    'Mermaid previews should not use run because it marks nodes processed before SVG replacement'
  )
  assert.match(
    source,
    /const setMarkdownPreviewRoot = \(element: HTMLElement \| null\): void => \{[\s\S]*void renderMermaidDiagrams\(element\)/,
    'Mermaid rendering should be requested as soon as the markdown root is attached'
  )
})

test('PDF previews render in-app without Electron PDF viewer frames', async () => {
  const source = await readPreviewContent()

  assert.match(
    source,
    /<PdfPreview[\s\S]*dataUrl=\{preview\.dataUrl\}/,
    'PDF previews should render through the app-owned PDF preview component'
  )
  assert.doesNotMatch(
    source,
    /preview\.previewType === 'pdf'[\s\S]*<iframe/,
    'PDF previews should avoid iframe-based Electron PDF viewer loading'
  )
})

test('PDF preview canvas keeps page aspect ratio when constrained', async () => {
  const source = await readPdfPreview()
  const css = await readMainCss()

  assert.match(
    source,
    /canvas\.style\.width = `\$\{viewport\.width\}px`/,
    'PDF pages should keep their intended display width before CSS constrains them'
  )
  assert.doesNotMatch(
    source,
    /canvas\.style\.height = `\$\{viewport\.height\}px`/,
    'PDF pages should not pin CSS height because max-width constraints would distort wide pages'
  )
  assert.match(
    css,
    /\.pdf-preview-page canvas\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?height:\s*auto;/,
    'PDF page canvases should shrink proportionally when wider than the preview panel'
  )
})

test('PDF preview lazily renders pages near the visible viewport', async () => {
  const source = await readPdfPreview()
  const css = await readMainCss()

  assert.match(
    source,
    /new IntersectionObserver\(/,
    'PDF preview should use an observer to render pages only as they approach the viewport'
  )
  assert.match(
    source,
    /if \(pageNumber === 1\) \{[\s\S]*await renderPage\(pageNumber, pageElement\)/,
    'PDF preview should still render the first page immediately'
  )
  assert.doesNotMatch(
    source,
    /for \(let pageNumber = 1; pageNumber <= pdf\.numPages; pageNumber \+= 1\)[\s\S]*await renderTask\.promise[\s\S]*\}/,
    'PDF preview should not synchronously render every page in the document'
  )
  assert.match(
    css,
    /\.pdf-preview-page\.pending\s*\{[\s\S]*?min-height:/,
    'PDF page placeholders should reserve scroll space before their canvases are rendered'
  )
})

test('PDF loading state clears after the first page renders', async () => {
  const source = await readPdfPreview()

  assert.match(
    source,
    /await renderTask\.promise[\s\S]*if \(!isCancelled && pageNumber === 1\) setStatus\('ready'\)/,
    'PDF loading state should disappear as soon as the first page is visible'
  )
  assert.doesNotMatch(
    source,
    /if \(!isCancelled\) setStatus\('ready'\)/,
    'PDF loading state should not wait for every page to finish rendering'
  )
})

test('PDF preview reports page count to the status bar instead of overlaying it', async () => {
  const previewSource = await readPdfPreview()
  const workspaceSource = await readWorkspaceView()
  const previewStatusMetadataHook = await readPreviewStatusMetadataHook()
  const statusBarSource = await readFile(
    new URL('../src/renderer/src/components/StatusBar.tsx', import.meta.url),
    'utf8'
  )
  const css = await readMainCss()

  assert.match(
    previewSource,
    /onPageCountChange\(pdf\.numPages\)/,
    'PDF preview should report the parsed total page count'
  )
  assert.match(
    workspaceSource,
    /<StatusBar[\s\S]*repository=\{repository\}[\s\S]*preview=\{preview\}[\s\S]*pdfPageCount=\{activePdfPageCount\}/,
    'Workspace should pass PDF page count to the status bar'
  )
  assert.match(
    previewStatusMetadataHook,
    /activePdfPageCount[\s\S]*pdfPageCount && pdfPageCount\.path === activePdfPath/,
    'preview status metadata should scope cached PDF page count to the active PDF path'
  )
  assert.match(
    statusBarSource,
    /getStatusBarFileFacts\(preview, \{ pdfPageCount \}\)/,
    'Status bar should include PDF page count in file facts'
  )
  assert.doesNotMatch(
    previewSource,
    /pdf-preview-count/,
    'PDF preview should not render a page count overlay in the preview surface'
  )
  assert.doesNotMatch(
    css,
    /\.pdf-preview-count/,
    'PDF preview should not reserve CSS for an overlay page count'
  )
})

test('image preview lightbox supports click, keyboard, and adjacent image navigation', async () => {
  const previewSource = await readPreviewContent()
  const imageLightboxHookSource = await readPreviewImageLightboxHook()
  const markdownPreviewSource = await readMarkdownPreview()
  const lightboxSource = await readImageLightbox()
  const css = await readMainCss()

  assert.match(
    imageLightboxHookSource,
    /collectPreviewImages\(container\.querySelectorAll\('img'\)\)/,
    'image lightbox should collect images from the current preview only'
  )
  assert.match(
    markdownPreviewSource,
    /onPreviewImageClick\(event\.currentTarget, event\)[\s\S]*if \(event\.defaultPrevented\) return[\s\S]*handleMarkdownLinkClick\(event\)/,
    'markdown image clicks should open the lightbox before linked images can navigate'
  )
  assert.match(
    markdownPreviewSource,
    /if \(event\.target\.closest\('img'\)\) return[\s\S]*const link = event\.target\.closest<HTMLAnchorElement>\('a\[data-markdown-link\]'\)/,
    'linked image context menus should fall through to the browser image menu'
  )
  assert.match(
    imageLightboxHookSource,
    /event\.key === 'Escape'[\s\S]*closeImageLightbox\(\)/,
    'image lightbox should close from the keyboard'
  )
  assert.match(
    imageLightboxHookSource,
    /event\.key === 'ArrowLeft'[\s\S]*stepImageLightbox\(-1\)[\s\S]*event\.key === 'ArrowRight'[\s\S]*stepImageLightbox\(1\)/,
    'image lightbox should navigate adjacent images from the keyboard'
  )
  assert.match(
    lightboxSource,
    /onWheel=\{\(event\) => \{[\s\S]*getSteppedPreviewImageZoom[\s\S]*onDoubleClick=\{\(event\) => \{[\s\S]*getToggledPreviewImageZoom/,
    'image lightbox should support mouse zoom through wheel and double click'
  )
  assert.match(
    lightboxSource,
    /onPointerDown=\{handleImagePointerDown\}[\s\S]*onPointerMove=\{handleImagePointerMove\}[\s\S]*onPointerUp=\{handleImagePointerEnd\}/,
    'image lightbox should support dragging a zoomed image to inspect clipped regions'
  )
  assert.match(
    lightboxSource,
    /clampPreviewImagePan\(/,
    'image lightbox should keep dragged zoomed images within visible bounds'
  )
  assert.doesNotMatch(
    imageLightboxHookSource,
    /type ImageLightboxState = \{[\s\S]*zoom: number[\s\S]*\}/,
    'wheel zoom state should stay inside the lightbox so large previews do not rerender on every wheel event'
  )
  assert.match(
    lightboxSource,
    /export function ImageLightbox\(/,
    'image lightbox rendering should be isolated from the heavier preview content'
  )
  assert.match(
    previewSource,
    /key=\{[\s\S]*activeImageLightbox\.index[\s\S]*activeImageLightbox\.images\[activeImageLightbox\.index\]\?\.src/,
    'image navigation should remount the lightbox by index before src so duplicate image URLs reset zoom'
  )
  assert.match(
    lightboxSource,
    /role="dialog"[\s\S]*aria-modal="true"[\s\S]*className="image-lightbox-nav previous"[\s\S]*className="image-lightbox-nav next"/,
    'image lightbox should render a modal with previous and next controls'
  )
  assert.match(
    css,
    /\.image-lightbox\s*\{[\s\S]*position:\s*fixed;[\s\S]*inset:\s*0;[\s\S]*z-index:\s*50;/,
    'image lightbox should overlay the current window'
  )
  assert.match(
    css,
    /\.image-lightbox-image\s*\{[\s\S]*cursor:\s*zoom-in;[\s\S]*transform-origin:\s*center;[\s\S]*touch-action:\s*none;/,
    'image lightbox should expose the enlarged image as zoomable and draggable'
  )
  assert.match(
    css,
    /\.image-lightbox-image\.is-pannable\s*\{[\s\S]*cursor:\s*grab;[\s\S]*\}[\s\S]*\.image-lightbox-image\.is-dragging\s*\{[\s\S]*cursor:\s*grabbing;/,
    'image lightbox should communicate when a zoomed image can be dragged'
  )
})

test('expanded sidebar keeps sidebar and history controls out of the sidebar titlebar', async () => {
  const source = await readWorkspaceView()
  const sidebarTitlebar = source.match(
    /<div className="sidebar-titlebar">([\s\S]*?)<\/div>\s*<BranchControls/
  )

  assert.ok(sidebarTitlebar, 'sidebar titlebar should exist')
  assert.doesNotMatch(
    sidebarTitlebar[1],
    /HistoryButtons|aria-label="Hide files"/,
    'expanded sidebar should leave sidebar and history controls in the preview titlebar'
  )
})

test('files sidebar resize keeps a 170px minimum width', async () => {
  const source = await readPanelResizeHook()

  assert.match(
    source,
    /Math\.min\(Math\.max\(event\.clientX,\s*170\),\s*520\)/,
    'files sidebar should clamp drag resizing to a 170px minimum'
  )
})

test('files sidebar initializes at 250px wide', async () => {
  const source = await readPanelResizeHook()

  assert.match(source, /useState\(250\)/, 'files sidebar should default to a compact 250px width')
})

test('files sidebar width is saved and restored with the project session', async () => {
  const workspaceSource = await readRepositoryWorkspaceHook()
  const persistenceSource = await readSessionPersistenceHook()

  assert.match(
    persistenceSource,
    /sidebarWidth[\s\S]*window\.api\.saveSession\(\{[\s\S]*sidebarWidth/,
    'session persistence should accept and save the current sidebar width'
  )
  assert.match(
    workspaceSource,
    /const \{ sidebarWidth, setSidebarWidth, isResizing, startResizing \} = usePanelResize\(\)/,
    'workspace should receive a sidebar width setter'
  )
  assert.match(
    workspaceSource,
    /restoreRepositorySession[\s\S]*createRestoredRepositorySession\(nextRepository, session\)[\s\S]*if \(session\.sidebarWidth\) setSidebarWidth\(session\.sidebarWidth\)/,
    'workspace should restore the saved sidebar width when a project session loads'
  )
})

test('files sidebar collapsed state is saved and restored with the project session', async () => {
  const workspaceSource = await readRepositoryWorkspaceHook()
  const persistenceSource = await readSessionPersistenceHook()

  assert.match(
    persistenceSource,
    /isSidebarOpen[\s\S]*window\.api\.saveSession\(\{[\s\S]*isSidebarOpen/,
    'session persistence should accept and save the current sidebar visibility'
  )
  assert.match(
    workspaceSource,
    /restoreRepositorySession[\s\S]*createRestoredRepositorySession\(nextRepository, session\)[\s\S]*if \(typeof session\.isSidebarOpen === 'boolean'\) \{[\s\S]*setIsSidebarOpen\(session\.isSidebarOpen\)/,
    'workspace should restore saved sidebar visibility when a project session loads'
  )
})

test('files sidebar layout resets for projects without saved session state', async () => {
  const workspaceSource = await readRepositoryWorkspaceHook()

  assert.match(
    workspaceSource,
    /const resetRepositoryLayout = useCallback\([\s\S]*setSidebarWidth\(250\)[\s\S]*setIsSidebarOpen\(true\)/,
    'workspace should have a default layout reset for projects without saved session state'
  )
  assert.match(
    workspaceSource,
    /const openRepository = useCallback[\s\S]*if \(projectSession\)[\s\S]*return[\s\S]*resetRepositoryLayout\(\)/,
    'repository picker should reset layout when no project session exists'
  )
  assert.match(
    workspaceSource,
    /const loadRepositoryPath = useCallback[\s\S]*if \(normalizedProjectSession\)[\s\S]*return[\s\S]*resetRepositoryLayout\(\)/,
    'repository path opens should reset layout when no project session exists'
  )
})

test('files tree rows use compact spacing for narrow sidebars', async () => {
  const css = await readMainCss()

  assert.match(
    css,
    /\.tree-row\s*\{[\s\S]*?width:\s*calc\(100% - 4px\);[\s\S]*?min-height:\s*28px;[\s\S]*?margin:\s*0 2px;[\s\S]*?padding:\s*0 6px 0 calc\(6px \+ \(var\(--level, 0\) \* 14px\)\);[\s\S]*?border-radius:\s*6px;/,
    'files tree rows should use compact height, margins, indentation, and radius'
  )
  assert.match(
    css,
    /\.tree-toggle\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*28px;[\s\S]*?margin-right:\s*1px;/,
    'files tree toggles should stay compact'
  )
  assert.match(
    css,
    /\.tree-node-button\s*\{[\s\S]*?gap:\s*5px;[\s\S]*?height:\s*28px;/,
    'files tree labels should use compact icon spacing and height'
  )
  assert.match(
    css,
    /\.tree-node-name\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?line-height:\s*18px;/,
    'files tree labels should use compact readable text'
  )
  assert.match(css, /\.tree-spacer\s*\{[\s\S]*?width:\s*17px;/, 'file rows should align compactly')
})

test('files tree marks the dirty edited file', async () => {
  const workspaceSource = await readWorkspaceView()
  const treeRowSource = await readTreeRow()
  const css = await readMainCss()

  assert.match(
    workspaceSource,
    /dirtyPath=\{hasUnsavedChanges \? selectedPath : undefined\}/,
    'workspace should pass the unsaved file path into the files tree'
  )
  assert.match(
    treeRowSource,
    /dirtyPath\?: string[\s\S]*const isDirty = dirtyPath === node\.path/,
    'tree rows should identify the file node with unsaved changes'
  )
  assert.match(
    treeRowSource,
    /isDirty &&[\s\S]*className="tree-node-dirty"/,
    'dirty tree rows should render a compact file-name indicator'
  )
  assert.match(
    treeRowSource,
    /dirtyPath=\{dirtyPath\}/,
    'dirty file state should propagate through recursive tree rows'
  )
  assert.match(
    css,
    /\.tree-node-dirty\s*\{[\s\S]*margin-left:\s*auto;[\s\S]*border-radius:\s*50%;[\s\S]*background:\s*#9a6700;/,
    'tree dirty indicator should align to the right edge while matching the tab and breadcrumb dot'
  )
  assert.match(
    treeRowSource,
    /!isDirty && node\.gitStatus === 'modified'[\s\S]*className="tree-node-git-status"[\s\S]*M/,
    'Git-modified files should show an M badge when there are no unsaved editor changes'
  )
  assert.match(
    css,
    /\.tree-node-git-status\s*\{[\s\S]*margin-left:\s*auto;[\s\S]*color:\s*#9a6700;/,
    'tree Git status should align to the right edge like VS Code file decorations'
  )
})

test('saving an edited file refreshes Git status decorations', async () => {
  const source = await readWorkspaceEditingHook()

  assert.match(
    source,
    /if \(!repository \|\| !preview \|\| !editablePreviewTarget \|\| !isEditing \|\| !hasUnsavedChanges\) \{[\s\S]*return[\s\S]*\}/,
    'saving should no-op when the editor draft has no changes'
  )
  assert.match(
    source,
    /const nextRepository = await window\.api\.loadRepository\(repository\.path\)[\s\S]*setRepository\(nextRepository\)/,
    'saving a file should refresh the repository tree so saved Git modifications can show M'
  )
})

test('editing mode routes editor state into the status bar', async () => {
  const workspaceSource = await readWorkspaceView()
  const previewStatusMetadataHook = await readPreviewStatusMetadataHook()
  const fileEditorSource = await readFileEditor()
  const statusBarSource = await readFile(
    new URL('../src/renderer/src/components/StatusBar.tsx', import.meta.url),
    'utf8'
  )

  assert.match(
    fileEditorSource,
    /onStatusChange: \(status: EditorStatusBarState\) => void/,
    'FileEditor should expose cursor, selection, character, and indentation status changes'
  )
  assert.match(
    fileEditorSource,
    /EditorView\.updateListener\.of/,
    'FileEditor should observe CodeMirror updates for status bar changes'
  )
  assert.match(
    previewStatusMetadataHook,
    /const \[editorStatus, setEditorStatus\]/,
    'preview status metadata should keep the latest editor status while editing'
  )
  assert.match(
    workspaceSource,
    /onStatusChange=\{setEditorStatus\}/,
    'Workspace should receive status updates from the editor'
  )
  assert.match(
    workspaceSource,
    /encoding=\{editablePreviewTarget\.encoding\}/,
    'Workspace should pass the preview encoding into the editor status'
  )
  assert.match(
    workspaceSource,
    /modifiedAt=\{editablePreviewTarget\.modifiedAt\}/,
    'Workspace should pass the preview modified time into the editor status'
  )
  assert.match(
    workspaceSource,
    /lastChange=\{editablePreviewTarget\.lastChange\}/,
    'Workspace should pass the preview Git author metadata into the editor status'
  )
  assert.match(
    workspaceSource,
    /editorStatus=\{editorStatusForStatusBar\}/,
    'StatusBar should switch to editor facts only when the editor pane is visible'
  )
  assert.match(
    previewStatusMetadataHook,
    /const editorStatusWithFileMetadata =[\s\S]*modifiedAt: editablePreviewTarget\.modifiedAt/,
    'preview status metadata should stay in sync with the latest preview after saving'
  )
  assert.match(
    previewStatusMetadataHook,
    /const editorStatusForStatusBar = showsEditor \? editorStatusWithFileMetadata : undefined/,
    'preview status metadata should expose editor facts only when the editor pane is visible'
  )
  assert.match(
    statusBarSource,
    /getStatusBarEditorFacts\(editorStatus\)/,
    'StatusBar should render editor-specific facts when editor status is available'
  )
})

test('editor status does not rescan indentation on cursor-only changes', async () => {
  const fileEditorSource = await readFileEditor()

  assert.doesNotMatch(
    fileEditorSource,
    /indentation = detectIndentation\(state\.doc\.toString\(\), state\.tabSize\)/,
    'getEditorStatus should not default to a full document indentation scan'
  )
  assert.match(
    fileEditorSource,
    /update\.docChanged[\s\S]*\? detectIndentation\(update\.state\.doc\.toString\(\), update\.state\.tabSize\)[\s\S]*: contentIndentation/,
    'FileEditor should rescan indentation only when the document changes'
  )
})
