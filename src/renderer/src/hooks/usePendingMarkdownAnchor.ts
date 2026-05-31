import { useCallback, useRef, useState } from 'react'

export type PendingMarkdownAnchor = {
  path: string
  hash: string
  token: number
}

export function usePendingMarkdownAnchor(): {
  pendingMarkdownAnchor: PendingMarkdownAnchor | undefined
  queuePendingMarkdownAnchor: (path: string, hash: string) => void
  clearPendingMarkdownAnchor: (token: number) => void
} {
  const nextAnchorToken = useRef(0)
  const [pendingMarkdownAnchor, setPendingMarkdownAnchor] = useState<
    PendingMarkdownAnchor | undefined
  >()

  const queuePendingMarkdownAnchor = useCallback((path: string, hash: string): void => {
    nextAnchorToken.current += 1
    setPendingMarkdownAnchor({
      path,
      hash,
      token: nextAnchorToken.current
    })
  }, [])

  const clearPendingMarkdownAnchor = useCallback((token: number): void => {
    setPendingMarkdownAnchor((current) => (current?.token === token ? undefined : current))
  }, [])

  return {
    pendingMarkdownAnchor,
    queuePendingMarkdownAnchor,
    clearPendingMarkdownAnchor
  }
}
