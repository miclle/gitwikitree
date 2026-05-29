import { useEffect, useState } from 'react'

export function usePanelResize(): {
  sidebarWidth: number
  setSidebarWidth: (width: number) => void
  isResizing: boolean
  startResizing: () => void
} {
  const [sidebarWidth, setSidebarWidth] = useState(250)
  const [isResizing, setIsResizing] = useState(false)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent): void => {
      setSidebarWidth(Math.min(Math.max(event.clientX, 170), 520))
    }
    const handleMouseUp = (): void => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  return {
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    startResizing: () => setIsResizing(true)
  }
}
