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
