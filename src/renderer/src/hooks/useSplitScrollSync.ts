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

    const syncPanelScroll = (source: HTMLElement, target: HTMLElement): void => {
      if (isSyncing) return

      isSyncing = true
      syncScrollPosition(source, target)
      releaseSyncFrame = window.requestAnimationFrame(() => {
        isSyncing = false
      })
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

      const handleEditorScroll = (): void => syncPanelScroll(editorScroller, previewPane)
      const handlePreviewScroll = (): void => syncPanelScroll(previewPane, editorScroller)

      editorScroller.addEventListener('scroll', handleEditorScroll)
      previewPane.addEventListener('scroll', handlePreviewScroll)

      cleanupScrollSync = () => {
        editorScroller.removeEventListener('scroll', handleEditorScroll)
        previewPane.removeEventListener('scroll', handlePreviewScroll)
      }
    }

    attachScrollSync()

    return () => {
      cleanupScrollSync?.()
      if (syncFrame) window.cancelAnimationFrame(syncFrame)
      if (releaseSyncFrame) window.cancelAnimationFrame(releaseSyncFrame)
    }
  }, [isSplitMode, splitScrollSyncElement])

  return splitScrollSyncRef
}
