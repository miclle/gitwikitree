import { useCallback, useEffect, useState, type RefCallback } from 'react'

function getMaxScrollTop(element: HTMLElement): number {
  return Math.max(0, element.scrollHeight - element.clientHeight)
}

function syncScrollPosition(source: HTMLElement, target: HTMLElement): void {
  const sourceMaxScrollTop = getMaxScrollTop(source)
  const targetMaxScrollTop = getMaxScrollTop(target)
  const scrollRatio = sourceMaxScrollTop > 0 ? source.scrollTop / sourceMaxScrollTop : 0

  target.scrollTop = targetMaxScrollTop * scrollRatio
}

function getPreviewScrollElement(previewPane: HTMLElement): HTMLElement {
  return previewPane.querySelector<HTMLElement>('.marp-preview') ?? previewPane
}

export function useSplitScrollSync(isSplitMode: boolean): RefCallback<HTMLDivElement> {
  const [splitScrollSyncElement, setSplitScrollSyncElement] = useState<HTMLDivElement | null>(null)
  const splitScrollSyncRef = useCallback((element: HTMLDivElement | null): void => {
    setSplitScrollSyncElement(element)
  }, [])

  useEffect(() => {
    if (!isSplitMode || !splitScrollSyncElement) return undefined

    let isSyncing = false
    let syncFrame = 0
    let releaseSyncFrame = 0
    let cleanupScrollSync: (() => void) | undefined
    let previewMutationObserver: MutationObserver | undefined

    const syncPanelScroll = (source: HTMLElement, target: HTMLElement): void => {
      if (isSyncing) return

      isSyncing = true
      syncScrollPosition(source, target)
      releaseSyncFrame = window.requestAnimationFrame(() => {
        isSyncing = false
      })
    }

    const bindScrollSync = (editorScroller: HTMLElement, previewScroller: HTMLElement): void => {
      cleanupScrollSync?.()

      const handleEditorScroll = (): void => syncPanelScroll(editorScroller, previewScroller)
      const handlePreviewScroll = (): void => syncPanelScroll(previewScroller, editorScroller)

      editorScroller.addEventListener('scroll', handleEditorScroll)
      previewScroller.addEventListener('scroll', handlePreviewScroll)

      cleanupScrollSync = () => {
        editorScroller.removeEventListener('scroll', handleEditorScroll)
        previewScroller.removeEventListener('scroll', handlePreviewScroll)
      }
    }

    const attachScrollSync = (): void => {
      const editorScroller = splitScrollSyncElement.querySelector<HTMLElement>(
        '.file-editor .cm-scroller'
      )
      const previewPane = splitScrollSyncElement.querySelector<HTMLElement>('.file-preview-pane')

      if (!editorScroller || !previewPane) {
        syncFrame = window.requestAnimationFrame(attachScrollSync)
        return
      }

      let activePreviewScroller: HTMLElement | undefined

      const bindCurrentPreviewScroller = (): void => {
        const nextPreviewScroller = getPreviewScrollElement(previewPane)
        if (nextPreviewScroller === activePreviewScroller) return

        activePreviewScroller = nextPreviewScroller
        bindScrollSync(editorScroller, nextPreviewScroller)
      }

      bindCurrentPreviewScroller()

      previewMutationObserver = new MutationObserver(bindCurrentPreviewScroller)
      previewMutationObserver.observe(previewPane, { childList: true, subtree: true })
    }

    attachScrollSync()

    return () => {
      previewMutationObserver?.disconnect()
      cleanupScrollSync?.()
      if (syncFrame) window.cancelAnimationFrame(syncFrame)
      if (releaseSyncFrame) window.cancelAnimationFrame(releaseSyncFrame)
    }
  }, [isSplitMode, splitScrollSyncElement])

  return splitScrollSyncRef
}
