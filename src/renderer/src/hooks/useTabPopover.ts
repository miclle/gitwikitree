import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { OpenFileTab } from '../app-navigation'

type TabPopoverState = {
  tab: OpenFileTab
  left: number
  visible: boolean
}

const tabPopoverWidth = 280
const tabPopoverInset = 8

export function useTabPopover(): {
  titlebarTabsRef: React.MutableRefObject<HTMLElement | null>
  tabPopover: TabPopoverState | undefined
  tabPopoverStyle: CSSProperties | undefined
  showTabPopover: (tab: OpenFileTab, tabElement: HTMLElement) => void
  hideTabPopover: (delayed?: boolean) => void
  handleTitlebarTabsPointerLeave: (event: ReactPointerEvent<HTMLElement>) => void
} {
  const titlebarTabsRef = useRef<HTMLElement | null>(null)
  const tabPopoverTimer = useRef<number | undefined>(undefined)
  const tabPopoverHideTimer = useRef<number | undefined>(undefined)
  const isTabPopoverVisible = useRef(false)
  const [tabPopover, setTabPopover] = useState<TabPopoverState | undefined>()

  const clearTabPopoverTimer = useCallback((): void => {
    if (tabPopoverTimer.current === undefined) return
    window.clearTimeout(tabPopoverTimer.current)
    tabPopoverTimer.current = undefined
  }, [])

  const clearTabPopoverHideTimer = useCallback((): void => {
    if (tabPopoverHideTimer.current === undefined) return
    window.clearTimeout(tabPopoverHideTimer.current)
    tabPopoverHideTimer.current = undefined
  }, [])

  const getTabPopoverLeft = useCallback((tabElement: HTMLElement): number => {
    const tabsRect = titlebarTabsRef.current?.getBoundingClientRect()
    const tabRect = tabElement.getBoundingClientRect()
    const center = tabRect.left + tabRect.width / 2 - (tabsRect?.left ?? 0)

    if (!tabsRect) return center

    const popoverWidth = Math.min(tabPopoverWidth, window.innerWidth * 0.7)
    const minLeft = popoverWidth / 2 + tabPopoverInset
    const maxLeft = tabsRect.width - popoverWidth / 2 - tabPopoverInset

    if (maxLeft < minLeft) return tabsRect.width / 2

    return Math.min(Math.max(center, minLeft), maxLeft)
  }, [])

  const showTabPopover = useCallback(
    (tab: OpenFileTab, tabElement: HTMLElement): void => {
      clearTabPopoverTimer()
      clearTabPopoverHideTimer()

      const left = getTabPopoverLeft(tabElement)

      if (isTabPopoverVisible.current) {
        setTabPopover({ tab, left, visible: true })
        return
      }

      setTabPopover({ tab, left, visible: false })
      tabPopoverTimer.current = window.setTimeout(() => {
        isTabPopoverVisible.current = true
        tabPopoverTimer.current = undefined
        setTabPopover({ tab, left, visible: true })
      }, 360)
    },
    [clearTabPopoverHideTimer, clearTabPopoverTimer, getTabPopoverLeft]
  )

  const hideTabPopover = useCallback(
    (delayed = false): void => {
      clearTabPopoverTimer()
      clearTabPopoverHideTimer()

      const hide = (): void => {
        tabPopoverHideTimer.current = undefined
        isTabPopoverVisible.current = false
        setTabPopover((current) => (current ? { ...current, visible: false } : undefined))
      }

      if (!delayed) {
        hide()
        return
      }

      tabPopoverHideTimer.current = window.setTimeout(hide, 120)
    },
    [clearTabPopoverHideTimer, clearTabPopoverTimer]
  )

  const handleTitlebarTabsPointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      const nextTarget = event.relatedTarget
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
      hideTabPopover(true)
    },
    [hideTabPopover]
  )

  const tabPopoverStyle: CSSProperties | undefined = tabPopover
    ? ({ '--tab-popover-left': `${tabPopover.left}px` } as CSSProperties)
    : undefined

  return {
    titlebarTabsRef,
    tabPopover,
    tabPopoverStyle,
    showTabPopover,
    hideTabPopover,
    handleTitlebarTabsPointerLeave
  }
}
