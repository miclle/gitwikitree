import { useEffect, useState } from 'react'

export function usePanelResize(): {
  sidebarWidth: number
  isResizing: boolean
  startResizing: () => void
} {
  const [sidebarWidth, setSidebarWidth] = useState(360)
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
    isResizing,
    startResizing: () => setIsResizing(true)
  }
}
