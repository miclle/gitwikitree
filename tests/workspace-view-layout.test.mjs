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

async function readMainCss() {
  return readFile(new URL('../src/renderer/src/assets/main.css', import.meta.url), 'utf8')
}

async function readPanelResizeHook() {
  return readFile(new URL('../src/renderer/src/hooks/usePanelResize.ts', import.meta.url), 'utf8')
}

async function readRepositoryWorkspaceHook() {
  return readFile(
    new URL('../src/renderer/src/hooks/useRepositoryWorkspace.ts', import.meta.url),
    'utf8'
  )
}

async function readPreviewContent() {
  return readFile(
    new URL('../src/renderer/src/components/PreviewContent.tsx', import.meta.url),
    'utf8'
  )
}

test('preview titlebar places file tabs in the titlebar row', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /<div className="main-titlebar">[\s\S]*\{fileTabsNav\}[\s\S]*<\/div>/,
    'preview titlebar should render the file tab strip inside the titlebar'
  )
})

test('preview titlebar places sidebar and history controls before the tab strip', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /<div className="main-titlebar">[\s\S]*<div className="main-titlebar-actions">[\s\S]*aria-label=\{isSidebarOpen \? 'Hide files' : 'Show files'\}[\s\S]*<HistoryButtons[\s\S]*\{fileTabsNav\}/,
    'preview titlebar should place sidebar and history controls before all tabs'
  )
})

test('collapsed sidebar omits the repository label from the tab bar', async () => {
  const source = await readWorkspaceView()
  const collapsedTitlebar = source.match(/<div className="main-titlebar">([\s\S]*?)\{fileTabsNav\}/)

  assert.ok(collapsedTitlebar, 'preview titlebar should exist')
  assert.doesNotMatch(
    collapsedTitlebar[1],
    /titlebar-repository/,
    'preview titlebar should match Notion by leaving the repository label out of the tab bar'
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
  const source = await readWorkspaceView()

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
  const source = await readWorkspaceView()

  assert.match(
    source,
    /window\.api\.onOpenCurrentTabSearch\(openPreviewSearch\)/,
    'workspace should subscribe to the current-tab search app menu command'
  )
})

test('global repository search is available from the sidebar and keyboard shortcut', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /const \[isGlobalSearchOpen, setIsGlobalSearchOpen\] = useState\(false\)/,
    'workspace should keep global search modal state'
  )
  assert.match(
    source,
    /window\.api\.onOpenGlobalSearch\(\(\) => setIsGlobalSearchOpen\(true\)\)/,
    'workspace should subscribe to the app menu global search command'
  )
  assert.match(
    source,
    /event\.shiftKey[\s\S]*setIsGlobalSearchOpen\(true\)/,
    'Command/Ctrl+Shift+F should open global search'
  )
  assert.match(
    source,
    /<GlobalSearchModal[\s\S]*open=\{isGlobalSearchOpen\}/,
    'workspace should render the global search modal'
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

test('restored active file tabs reveal their item in the tree', async () => {
  const source = await readRepositoryWorkspaceHook()

  assert.match(
    source,
    /restoreRepositorySession[\s\S]*setExpandedPaths\([\s\S]*new Set\(\[[\s\S]*\.\.\.\(session\.expandedPaths\.length \? session\.expandedPaths : \[''\]\),[\s\S]*\.\.\.parentPaths\(nextSelectedPath\)[\s\S]*\]\)[\s\S]*\)/,
    'restoring a window should expand ancestor folders for the active tab'
  )
})

test('current tab search command seeds the query from selected preview text', async () => {
  const source = await readWorkspaceView()

  assert.match(
    source,
    /const previewBodyRef = useRef<HTMLDivElement \| null>\(null\)/,
    'workspace should keep a ref to the searchable preview content'
  )
  assert.match(
    source,
    /getSelectedPreviewSearchText\(window\.getSelection\(\), previewBodyRef\.current\)/,
    'opening search should read the current selection from the preview content'
  )
  assert.match(
    source,
    /if \(selectedText\) \{[\s\S]*setSearchQuery\(selectedText\)[\s\S]*setActiveSearchIndex\(-1\)[\s\S]*\}/,
    'selected preview text should seed the search query and reset the active match'
  )
  assert.match(
    source,
    /<div className="preview-body" ref=\{previewBodyRef\}>/,
    'preview body should be the search selection boundary'
  )
})

test('current tab search closes on Escape even when the find input is blurred', async () => {
  const source = await readWorkspaceView()

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
  const source = await readPreviewContent()

  assert.match(
    source,
    /const setHtmlPreviewRoot = \(element: HTMLIFrameElement \| null\): void => \{[\s\S]*previewSearchRootRef\.current = element\?\.contentDocument\?\.body \?\? null[\s\S]*\}/,
    'html preview should expose the iframe body to the current-tab search highlighter'
  )
  assert.match(
    source,
    /sandbox="allow-same-origin"/,
    'html preview iframe should remain script-disabled while allowing parent-side search access'
  )
  assert.match(
    source,
    /setSearchRootVersion\(\(version\) => version \+ 1\)/,
    'html preview load should rerun search once iframe content is available'
  )
})

test('image preview lightbox supports click, keyboard, and adjacent image navigation', async () => {
  const source = await readPreviewContent()
  const css = await readMainCss()

  assert.match(
    source,
    /collectPreviewImages\(container\.querySelectorAll\('img'\)\)/,
    'image lightbox should collect images from the current preview only'
  )
  assert.match(
    source,
    /handlePreviewImageClick\(event\.currentTarget\)\(event\)[\s\S]*if \(event\.defaultPrevented\) return[\s\S]*handleMarkdownLinkClick\(sourcePath\)\(event\)/,
    'markdown image clicks should open the lightbox before linked images can navigate'
  )
  assert.match(
    source,
    /if \(event\.target\.closest\('img'\)\) return[\s\S]*const link = event\.target\.closest<HTMLAnchorElement>\('a\[data-markdown-link\]'\)/,
    'linked image context menus should fall through to the browser image menu'
  )
  assert.match(
    source,
    /event\.key === 'Escape'[\s\S]*closeImageLightbox\(\)/,
    'image lightbox should close from the keyboard'
  )
  assert.match(
    source,
    /event\.key === 'ArrowLeft'[\s\S]*stepImageLightbox\(-1\)[\s\S]*event\.key === 'ArrowRight'[\s\S]*stepImageLightbox\(1\)/,
    'image lightbox should navigate adjacent images from the keyboard'
  )
  assert.match(
    source,
    /onWheel=\{\(event\) => \{[\s\S]*getSteppedPreviewImageZoom[\s\S]*onDoubleClick=\{\(event\) => \{[\s\S]*getToggledPreviewImageZoom/,
    'image lightbox should support mouse zoom through wheel and double click'
  )
  assert.doesNotMatch(
    source,
    /type ImageLightboxState = \{[\s\S]*zoom: number[\s\S]*\}/,
    'wheel zoom state should stay inside the lightbox so large previews do not rerender on every wheel event'
  )
  assert.match(
    source,
    /function ImageLightbox\(/,
    'image lightbox rendering should be isolated from the heavier preview content'
  )
  assert.match(
    source,
    /key=\{[\s\S]*activeImageLightbox\.index[\s\S]*activeImageLightbox\.images\[activeImageLightbox\.index\]\?\.src/,
    'image navigation should remount the lightbox by index before src so duplicate image URLs reset zoom'
  )
  assert.match(
    source,
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
    /\.image-lightbox-image\s*\{[\s\S]*cursor:\s*zoom-in;[\s\S]*transform-origin:\s*center;/,
    'image lightbox should expose the enlarged image as zoomable'
  )
})

test('expanded sidebar keeps sidebar and history controls out of the sidebar titlebar', async () => {
  const source = await readWorkspaceView()
  const sidebarTitlebar = source.match(
    /<div className="sidebar-titlebar">([\s\S]*?)<\/div>\s*<div className="sidebar-controls">/
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
    /\.tree-node-button span:last-child\s*\{[\s\S]*?font-size:\s*13px;[\s\S]*?line-height:\s*18px;/,
    'files tree labels should use compact readable text'
  )
  assert.match(css, /\.tree-spacer\s*\{[\s\S]*?width:\s*17px;/, 'file rows should align compactly')
})
