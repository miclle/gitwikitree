import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { getSelectedPreviewSearchText, getSteppedSearchIndex } from '../preview-search'

interface PreviewSearchControls {
  searchInputRef: MutableRefObject<HTMLInputElement | null>
  previewBodyRef: MutableRefObject<HTMLDivElement | null>
  isSearchOpen: boolean
  searchQuery: string
  appliedSearchQuery: string
  searchMatchCount: number
  activeSearchIndex: number
  isGlobalSearchOpen: boolean
  setIsGlobalSearchOpen: Dispatch<SetStateAction<boolean>>
  setSearchQuery: Dispatch<SetStateAction<string>>
  setActiveSearchIndex: Dispatch<SetStateAction<number>>
  openPreviewSearch: () => void
  closePreviewSearch: () => void
  stepSearchMatch: (direction: -1 | 1) => void
  handleSearchMatchCountChange: (count: number) => void
}

export function usePreviewSearchControls(): PreviewSearchControls {
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const previewBodyRef = useRef<HTMLDivElement | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchCount, setSearchMatchCount] = useState(0)
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1)
  const [searchFocusRequest, setSearchFocusRequest] = useState(0)
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false)
  const appliedSearchQuery = isSearchOpen ? searchQuery : ''

  const openPreviewSearch = useCallback(() => {
    const selectedText = getSelectedPreviewSearchText(window.getSelection(), previewBodyRef.current)
    if (selectedText) {
      setSearchQuery(selectedText)
      setActiveSearchIndex(-1)
    }

    setIsSearchOpen(true)
    setSearchFocusRequest((request) => request + 1)
  }, [])

  const closePreviewSearch = useCallback(() => {
    setIsSearchOpen(false)
    setActiveSearchIndex(-1)
  }, [])

  const stepSearchMatch = useCallback(
    (direction: -1 | 1): void => {
      setActiveSearchIndex((currentIndex) =>
        getSteppedSearchIndex({
          currentIndex,
          matchCount: searchMatchCount,
          direction
        })
      )
    },
    [searchMatchCount]
  )

  const handleSearchMatchCountChange = useCallback((count: number): void => {
    setSearchMatchCount(count)
    setActiveSearchIndex((currentIndex) => {
      if (count <= 0) return -1
      if (currentIndex < 0) return 0
      return Math.min(currentIndex, count - 1)
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault()
        closePreviewSearch()
        return
      }

      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault()
        setIsGlobalSearchOpen(true)
        return
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault()
        openPreviewSearch()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closePreviewSearch, isSearchOpen, openPreviewSearch])

  useEffect(() => {
    return window.api.onOpenGlobalSearch(() => setIsGlobalSearchOpen(true))
  }, [])

  useEffect(() => {
    return window.api.onOpenCurrentTabSearch(openPreviewSearch)
  }, [openPreviewSearch])

  useEffect(() => {
    if (!isSearchOpen) return

    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }, [isSearchOpen, searchFocusRequest])

  return {
    searchInputRef,
    previewBodyRef,
    isSearchOpen,
    searchQuery,
    appliedSearchQuery,
    searchMatchCount,
    activeSearchIndex,
    isGlobalSearchOpen,
    setIsGlobalSearchOpen,
    setSearchQuery,
    setActiveSearchIndex,
    openPreviewSearch,
    closePreviewSearch,
    stepSearchMatch,
    handleSearchMatchCountChange
  }
}
