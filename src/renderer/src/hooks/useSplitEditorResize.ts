import {
  useCallback,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent
} from 'react'

const MIN_SPLIT_PANE_WIDTH = 260
const SPLIT_KEYBOARD_STEP = 5

export function useSplitEditorResize(isSplitMode: boolean): {
  splitEditorPaneWidthPct: number
  splitWorkspaceStyle: CSSProperties | undefined
  handleSplitResizerPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  handleSplitResizerKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
} {
  const [splitEditorPaneWidthPct, setSplitEditorPaneWidthPct] = useState(50)
  const splitWorkspaceStyle = isSplitMode
    ? ({
        '--split-editor-width': `${splitEditorPaneWidthPct}%`
      } as CSSProperties)
    : undefined

  const handleSplitResizerPointerDown = useCallback((event: PointerEvent<HTMLDivElement>): void => {
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
    const handlePointerMove = (pointerEvent: globalThis.PointerEvent): void => {
      updateSplitWidth(pointerEvent.clientX)
    }
    const handlePointerUp = (pointerEvent: globalThis.PointerEvent): void => {
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
  }, [])

  const handleSplitResizerKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>): void => {
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
  }, [])

  return {
    splitEditorPaneWidthPct,
    splitWorkspaceStyle,
    handleSplitResizerPointerDown,
    handleSplitResizerKeyDown
  }
}
