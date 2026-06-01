import { useCallback, useLayoutEffect, useState, type RefCallback } from 'react'

type ScrollAnchor = {
  line: number
  top: number
  height: number
}

type PreviewLineAnchorElement = {
  element: HTMLElement
  line: number
}

type PreviewLineAnchorCache = {
  getAnchors: () => ScrollAnchor[]
  disconnect: () => void
}

type ScrollSourceId = 'editor' | 'preview'

const activeScrollSourceQuietMs = 180
const minimumScrollSyncDelta = 1

function getMaxScrollTop(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function getSyncedScrollPosition(source: HTMLElement, target: HTMLElement): number {
  const sourceMaxScrollTop = getMaxScrollTop(source)
  const targetMaxScrollTop = getMaxScrollTop(target)
  const scrollRatio = sourceMaxScrollTop > 0 ? source.scrollTop / sourceMaxScrollTop : 0

  return targetMaxScrollTop * scrollRatio
}

function getElementTopInScroller(
  element: HTMLElement,
  scroller: HTMLElement,
  scrollerRectTop = scroller.getBoundingClientRect().top
): number {
  const elementRect = element.getBoundingClientRect()

  return elementRect.top - scrollerRectTop + scroller.scrollTop
}

function getElementHeight(element: HTMLElement): number {
  return element.getBoundingClientRect().height || element.offsetHeight || 1
}

function getEditorLineAnchors(editorScroller: HTMLElement): ScrollAnchor[] {
  const lines = Array.from(editorScroller.querySelectorAll<HTMLElement>('.cm-content .cm-line'))
  const lineNumbers = Array.from(
    editorScroller.querySelectorAll<HTMLElement>('.cm-lineNumbers .cm-gutterElement')
  )
    .map((element) => ({
      element,
      line: Number.parseInt(element.textContent?.trim() ?? '', 10),
      top: getElementTopInScroller(element, editorScroller),
      height: element.getBoundingClientRect().height
    }))
    .filter((entry) => Number.isFinite(entry.line) && entry.height > 0)

  return lines
    .map((element) => {
      const lineTop = getElementTopInScroller(element, editorScroller)
      const lineNumber = lineNumbers.reduce<(typeof lineNumbers)[number] | undefined>(
        (best, candidate) => {
          if (!best) return candidate

          return Math.abs(candidate.top - lineTop) < Math.abs(best.top - lineTop) ? candidate : best
        },
        undefined
      )

      if (!lineNumber || Math.abs(lineNumber.top - lineTop) > getElementHeight(element)) {
        return undefined
      }

      return {
        line: lineNumber.line,
        top: lineTop,
        height: getElementHeight(element)
      }
    })
    .filter((anchor): anchor is ScrollAnchor => anchor !== undefined)
}

function getPreviewLineAnchorElements(previewScroller: HTMLElement): PreviewLineAnchorElement[] {
  const roots: ParentNode[] = [previewScroller]

  const collectShadowRoots = (root: ParentNode): void => {
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      if (!element.shadowRoot) continue

      roots.push(element.shadowRoot)
      collectShadowRoots(element.shadowRoot)
    }
  }

  collectShadowRoots(previewScroller)

  return roots.flatMap((root) =>
    Array.from(root.querySelectorAll<HTMLElement>('[data-source-line]'))
      .map((element) => {
        const line = Number.parseInt(element.dataset.sourceLine ?? '', 10)
        if (!Number.isFinite(line)) return undefined

        return { element, line }
      })
      .filter((anchor): anchor is PreviewLineAnchorElement => anchor !== undefined)
  )
}

function measurePreviewLineAnchors(
  previewScroller: HTMLElement,
  anchorElements: PreviewLineAnchorElement[]
): ScrollAnchor[] {
  const scrollerRectTop = previewScroller.getBoundingClientRect().top

  return anchorElements.map(({ element, line }) => ({
    line,
    top: getElementTopInScroller(element, previewScroller, scrollerRectTop),
    height: getElementHeight(element)
  }))
}

function createPreviewLineAnchorCache(previewScroller: HTMLElement): PreviewLineAnchorCache {
  let anchorElements: PreviewLineAnchorElement[] | undefined
  let anchors: ScrollAnchor[] | undefined

  const invalidateAnchors = (): void => {
    anchorElements = undefined
    anchors = undefined
  }
  const mutationObserver = new MutationObserver(invalidateAnchors)
  mutationObserver.observe(previewScroller, { childList: true, subtree: true, characterData: true })
  const resizeObserver = new ResizeObserver(invalidateAnchors)
  resizeObserver.observe(previewScroller)
  previewScroller.addEventListener('load', invalidateAnchors, true)
  previewScroller.addEventListener('preview-source-lines-change', invalidateAnchors, true)

  return {
    getAnchors: () => {
      anchorElements ??= getPreviewLineAnchorElements(previewScroller)
      anchors ??= measurePreviewLineAnchors(previewScroller, anchorElements)
      return anchors
    },
    disconnect: () => {
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      previewScroller.removeEventListener('load', invalidateAnchors, true)
      previewScroller.removeEventListener('preview-source-lines-change', invalidateAnchors, true)
    }
  }
}

export function getActiveScrollAnchor(
  anchors: ScrollAnchor[],
  scrollTop: number,
  viewportBias = 12
): ScrollAnchor | undefined {
  if (anchors.length === 0) return undefined

  const viewportTop = scrollTop + viewportBias
  let active = anchors[0]

  for (const anchor of anchors) {
    if (anchor.top > viewportTop) break
    active = anchor
  }

  return active
}

export function getNearestLineAnchor(
  anchors: ScrollAnchor[],
  line: number
): ScrollAnchor | undefined {
  let nearest: ScrollAnchor | undefined

  for (const anchor of anchors) {
    if (anchor.line > line) break
    nearest = anchor
  }

  return nearest ?? anchors[0]
}

function getAverageLineHeight(anchors: ScrollAnchor[]): number {
  if (anchors.length === 0) return 20

  const totalHeight = anchors.reduce((total, anchor) => total + anchor.height, 0)
  return Math.max(1, totalHeight / anchors.length)
}

function estimateEditorLineTop(anchors: ScrollAnchor[], line: number): number | undefined {
  const exactAnchor = anchors.find((anchor) => anchor.line === line)
  if (exactAnchor) return exactAnchor.top

  const firstAnchor = anchors[0]
  if (!firstAnchor) return undefined

  return firstAnchor.top + (line - firstAnchor.line) * getAverageLineHeight(anchors)
}

export function getAnchoredScrollTop({
  sourceAnchor,
  targetTop,
  sourceScrollTop,
  maxScrollTop
}: {
  sourceAnchor: ScrollAnchor
  targetTop: number
  sourceScrollTop: number
  maxScrollTop: number
}): number {
  const sourceAnchorViewportTop = sourceAnchor.top - sourceScrollTop

  return Math.min(maxScrollTop, Math.max(0, targetTop - sourceAnchorViewportTop))
}

export function getMappedAnchoredScrollTop({
  sourceAnchors,
  targetAnchors,
  sourceScrollTop,
  maxScrollTop,
  viewportBias = 12
}: {
  sourceAnchors: ScrollAnchor[]
  targetAnchors: ScrollAnchor[]
  sourceScrollTop: number
  maxScrollTop: number
  viewportBias?: number
}): number | undefined {
  if (sourceAnchors.length === 0 || targetAnchors.length !== sourceAnchors.length) {
    return undefined
  }

  const sourceViewportTop = sourceScrollTop + viewportBias
  let activeIndex = 0

  for (const [index, anchor] of sourceAnchors.entries()) {
    if (anchor.top > sourceViewportTop) break
    activeIndex = index
  }

  const sourceStart = sourceAnchors[activeIndex]
  const sourceEnd = sourceAnchors[activeIndex + 1]
  const targetStart = targetAnchors[activeIndex]
  const targetEnd = targetAnchors[activeIndex + 1]
  const progress =
    sourceEnd && targetEnd && sourceEnd.top > sourceStart.top
      ? Math.min(
          1,
          Math.max(0, (sourceViewportTop - sourceStart.top) / (sourceEnd.top - sourceStart.top))
        )
      : 0
  const targetViewportTop =
    targetStart.top + (targetEnd ? (targetEnd.top - targetStart.top) * progress : 0)

  return Math.min(maxScrollTop, Math.max(0, targetViewportTop - viewportBias))
}

export function shouldSyncScrollSource({
  activeSourceId,
  sourceId
}: {
  activeSourceId: string | undefined
  sourceId: string
}): boolean {
  return activeSourceId === undefined || activeSourceId === sourceId
}

function projectAnchors(
  anchors: ScrollAnchor[],
  getTop: (line: number) => number | undefined
): ScrollAnchor[] {
  return anchors
    .map((anchor) => {
      const top = getTop(anchor.line)
      if (top === undefined) return undefined

      return {
        ...anchor,
        top
      }
    })
    .filter((anchor): anchor is ScrollAnchor => anchor !== undefined)
}

function syncEditorToPreviewScroll(
  editorScroller: HTMLElement,
  previewScroller: HTMLElement,
  previewAnchorCache: PreviewLineAnchorCache
): number | undefined {
  const editorAnchors = getEditorLineAnchors(editorScroller)
  const previewAnchors = previewAnchorCache.getAnchors()
  const projectedEditorAnchors = projectAnchors(previewAnchors, (line) =>
    estimateEditorLineTop(editorAnchors, line)
  )
  const nextScrollTop = getMappedAnchoredScrollTop({
    sourceAnchors: projectedEditorAnchors,
    targetAnchors: previewAnchors.slice(0, projectedEditorAnchors.length),
    sourceScrollTop: editorScroller.scrollTop,
    maxScrollTop: getMaxScrollTop(previewScroller)
  })

  if (nextScrollTop === undefined) {
    return getSyncedScrollPosition(editorScroller, previewScroller)
  }

  return nextScrollTop
}

function syncPreviewToEditorScroll(
  previewScroller: HTMLElement,
  editorScroller: HTMLElement,
  previewAnchorCache: PreviewLineAnchorCache
): number | undefined {
  const editorAnchors = getEditorLineAnchors(editorScroller)
  const previewAnchors = previewAnchorCache.getAnchors()
  const projectedEditorAnchors = projectAnchors(previewAnchors, (line) =>
    estimateEditorLineTop(editorAnchors, line)
  )
  const nextScrollTop = getMappedAnchoredScrollTop({
    sourceAnchors: previewAnchors.slice(0, projectedEditorAnchors.length),
    targetAnchors: projectedEditorAnchors,
    sourceScrollTop: previewScroller.scrollTop,
    maxScrollTop: getMaxScrollTop(editorScroller)
  })

  if (nextScrollTop === undefined) {
    return getSyncedScrollPosition(previewScroller, editorScroller)
  }

  return nextScrollTop
}

function getPreviewScrollElement(previewPane: HTMLElement): HTMLElement {
  return previewPane.querySelector<HTMLElement>('.marp-preview') ?? previewPane
}

export function useSplitScrollSync(isSplitMode: boolean): RefCallback<HTMLDivElement> {
  const [splitScrollSyncElement, setSplitScrollSyncElement] = useState<HTMLDivElement | null>(null)
  const splitScrollSyncRef = useCallback((element: HTMLDivElement | null): void => {
    setSplitScrollSyncElement(element)
  }, [])

  useLayoutEffect(() => {
    if (!isSplitMode || !splitScrollSyncElement) return undefined

    let isSyncing = false
    let syncTimer = 0
    let releaseSyncTimer = 0
    let pendingSyncTimer = 0
    let clearActiveScrollSourceTimer = 0
    let refreshPreviewScrollerTimer = 0
    let activeScrollSource: ScrollSourceId | undefined
    let cleanupScrollSync: (() => void) | undefined
    let cleanupPreviewPaneSync: (() => void) | undefined
    let previewMutationObserver: MutationObserver | undefined
    let activeEditorScroller: HTMLElement | undefined
    let activePreviewPane: HTMLElement | undefined
    let activePreviewScroller: HTMLElement | undefined

    const markActiveScrollSource = (source: ScrollSourceId): void => {
      activeScrollSource = source

      if (clearActiveScrollSourceTimer) window.clearTimeout(clearActiveScrollSourceTimer)
      clearActiveScrollSourceTimer = window.setTimeout(() => {
        if (activeScrollSource === source) {
          activeScrollSource = undefined
        }
      }, activeScrollSourceQuietMs)
    }

    const syncPanelScroll = (
      source: ScrollSourceId,
      target: HTMLElement,
      getNextScrollTop: () => number | undefined
    ): void => {
      if (!shouldSyncScrollSource({ activeSourceId: activeScrollSource, sourceId: source })) return

      markActiveScrollSource(source)
      if (isSyncing) return

      if (pendingSyncTimer) window.clearTimeout(pendingSyncTimer)
      pendingSyncTimer = window.setTimeout(() => {
        pendingSyncTimer = 0
        const nextScrollTop = getNextScrollTop()
        if (nextScrollTop === undefined) return
        if (Math.abs(target.scrollTop - nextScrollTop) < minimumScrollSyncDelta) return

        isSyncing = true
        target.scrollTop = nextScrollTop
        if (releaseSyncTimer) window.clearTimeout(releaseSyncTimer)
        releaseSyncTimer = window.setTimeout(() => {
          isSyncing = false
          releaseSyncTimer = 0
        }, activeScrollSourceQuietMs)
      }, 0)
    }

    const bindScrollSync = (editorScroller: HTMLElement, previewScroller: HTMLElement): void => {
      cleanupScrollSync?.()
      const previewAnchorCache = createPreviewLineAnchorCache(previewScroller)

      const handleEditorScroll = (): void =>
        syncPanelScroll('editor', previewScroller, () =>
          syncEditorToPreviewScroll(editorScroller, previewScroller, previewAnchorCache)
        )
      const handlePreviewScroll = (): void =>
        syncPanelScroll('preview', editorScroller, () =>
          syncPreviewToEditorScroll(previewScroller, editorScroller, previewAnchorCache)
        )

      const markEditorScrollIntent = (): void => markActiveScrollSource('editor')
      const markPreviewScrollIntent = (): void => markActiveScrollSource('preview')
      const userScrollIntentOptions = { capture: true, passive: true }

      editorScroller.addEventListener('scroll', handleEditorScroll)
      previewScroller.addEventListener('scroll', handlePreviewScroll)
      editorScroller.addEventListener('wheel', markEditorScrollIntent, userScrollIntentOptions)
      editorScroller.addEventListener('touchstart', markEditorScrollIntent, userScrollIntentOptions)
      editorScroller.addEventListener('pointerdown', markEditorScrollIntent, true)
      editorScroller.addEventListener('keydown', markEditorScrollIntent, true)
      previewScroller.addEventListener('wheel', markPreviewScrollIntent, userScrollIntentOptions)
      previewScroller.addEventListener(
        'touchstart',
        markPreviewScrollIntent,
        userScrollIntentOptions
      )
      previewScroller.addEventListener('pointerdown', markPreviewScrollIntent, true)
      previewScroller.addEventListener('keydown', markPreviewScrollIntent, true)

      cleanupScrollSync = () => {
        previewAnchorCache.disconnect()
        editorScroller.removeEventListener('scroll', handleEditorScroll)
        previewScroller.removeEventListener('scroll', handlePreviewScroll)
        editorScroller.removeEventListener('wheel', markEditorScrollIntent, userScrollIntentOptions)
        editorScroller.removeEventListener(
          'touchstart',
          markEditorScrollIntent,
          userScrollIntentOptions
        )
        editorScroller.removeEventListener('pointerdown', markEditorScrollIntent, true)
        editorScroller.removeEventListener('keydown', markEditorScrollIntent, true)
        previewScroller.removeEventListener(
          'wheel',
          markPreviewScrollIntent,
          userScrollIntentOptions
        )
        previewScroller.removeEventListener(
          'touchstart',
          markPreviewScrollIntent,
          userScrollIntentOptions
        )
        previewScroller.removeEventListener('pointerdown', markPreviewScrollIntent, true)
        previewScroller.removeEventListener('keydown', markPreviewScrollIntent, true)
      }
    }

    const bindCurrentPreviewScroller = (): boolean => {
      const editorScroller = splitScrollSyncElement.querySelector<HTMLElement>(
        '.file-editor .cm-scroller'
      )
      const previewPane = splitScrollSyncElement.querySelector<HTMLElement>('.file-preview-pane')

      if (!editorScroller || !previewPane) {
        return false
      }

      if (previewPane !== activePreviewPane) {
        previewMutationObserver?.disconnect()
        cleanupPreviewPaneSync?.()
        activePreviewPane = previewPane

        previewMutationObserver = new MutationObserver(bindCurrentPreviewScroller)
        previewMutationObserver.observe(previewPane, { childList: true, subtree: true })
        previewPane.addEventListener('preview-source-lines-change', bindCurrentPreviewScroller)
        cleanupPreviewPaneSync = () => {
          previewPane.removeEventListener('preview-source-lines-change', bindCurrentPreviewScroller)
        }
      }

      const nextPreviewScroller = getPreviewScrollElement(previewPane)
      if (
        editorScroller !== activeEditorScroller ||
        nextPreviewScroller !== activePreviewScroller
      ) {
        activeEditorScroller = editorScroller
        activePreviewScroller = nextPreviewScroller
        bindScrollSync(editorScroller, nextPreviewScroller)
      }

      return true
    }

    const attachScrollSync = (): void => {
      if (!bindCurrentPreviewScroller()) {
        syncTimer = window.setTimeout(attachScrollSync, 16)
        return
      }

      syncTimer = window.setTimeout(bindCurrentPreviewScroller, 16)
      refreshPreviewScrollerTimer = window.setInterval(bindCurrentPreviewScroller, 250)
    }

    attachScrollSync()

    return () => {
      previewMutationObserver?.disconnect()
      cleanupPreviewPaneSync?.()
      cleanupScrollSync?.()
      if (syncTimer) window.clearTimeout(syncTimer)
      if (releaseSyncTimer) window.clearTimeout(releaseSyncTimer)
      if (pendingSyncTimer) window.clearTimeout(pendingSyncTimer)
      if (clearActiveScrollSourceTimer) window.clearTimeout(clearActiveScrollSourceTimer)
      if (refreshPreviewScrollerTimer) window.clearInterval(refreshPreviewScrollerTimer)
    }
  }, [isSplitMode, splitScrollSyncElement])

  return splitScrollSyncRef
}
