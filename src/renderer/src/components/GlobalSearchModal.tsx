import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Folder, Loader2, Search, X } from 'lucide-react'
import type { RepositoryPayload, RepositorySearchResult } from '../../../shared/types'

type GlobalSearchModalProps = {
  open: boolean
  repository: RepositoryPayload
  onOpenChange: (open: boolean) => void
  onOpenResult: (result: RepositorySearchResult) => void
}

export const GLOBAL_SEARCH_DEBOUNCE_MS = 300

type HighlightRange = {
  start: number
  end: number
}

function getSearchTerms(query: string): string[] {
  return Array.from(new Set(query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean))).sort(
    (first, second) => second.length - first.length
  )
}

function getHighlightRanges(text: string, query: string): HighlightRange[] {
  const terms = getSearchTerms(query)
  if (terms.length === 0) return []

  const lowerText = text.toLocaleLowerCase()
  const ranges: HighlightRange[] = []
  let cursor = 0

  while (cursor < text.length) {
    const matchingTerm = terms.find((term) => lowerText.startsWith(term, cursor))

    if (!matchingTerm) {
      cursor += 1
      continue
    }

    ranges.push({ start: cursor, end: cursor + matchingTerm.length })
    cursor += matchingTerm.length
  }

  return ranges
}

function HighlightText({ text, query }: { text: string; query: string }): React.JSX.Element {
  const ranges = getHighlightRanges(text, query)
  if (ranges.length === 0) return <>{text}</>

  const parts: React.ReactNode[] = []
  let cursor = 0

  ranges.forEach((range) => {
    if (range.start > cursor) {
      parts.push(text.slice(cursor, range.start))
    }

    parts.push(
      <mark key={`${range.start}:${range.end}`}>{text.slice(range.start, range.end)}</mark>
    )
    cursor = range.end
  })

  if (cursor < text.length) {
    parts.push(text.slice(cursor))
  }

  return <>{parts}</>
}

export function GlobalSearchModal({
  open,
  repository,
  onOpenChange,
  onOpenResult
}: GlobalSearchModalProps): React.JSX.Element | null {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RepositorySearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)
  const latestQueryRef = useRef('')
  const inFlightSearchRef = useRef(false)
  const queuedSearchRef = useRef(false)
  const [searchKick, setSearchKick] = useState(0)
  const trimmedQuery = query.trim()
  const selectedResult = results[selectedIndex]
  const sourceLabel = useMemo(() => {
    if (repository.source === 'worktree') return `${repository.activeRef} worktree`
    return repository.branch
  }, [repository.activeRef, repository.branch, repository.source])

  useEffect(() => {
    if (!open) return

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [open])

  useEffect(() => {
    latestQueryRef.current = trimmedQuery
  }, [trimmedQuery])

  useEffect(() => {
    if (!open) return
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    if (!trimmedQuery) {
      return
    }

    const timeout = window.setTimeout(() => {
      if (inFlightSearchRef.current) {
        queuedSearchRef.current = true
        return
      }

      const queryToSearch = latestQueryRef.current
      if (!queryToSearch) return

      inFlightSearchRef.current = true
      setIsSearching(true)
      setError(undefined)

      void window.api
        .searchRepository(repository.path, queryToSearch, {
          source: repository.source,
          rootPath: repository.rootPath
        })
        .then((items) => {
          if (requestIdRef.current !== requestId || latestQueryRef.current !== queryToSearch) return
          setResults(items)
          setSelectedIndex(0)
        })
        .catch((reason) => {
          if (requestIdRef.current !== requestId) return
          setResults([])
          setError(reason instanceof Error ? reason.message : String(reason))
        })
        .finally(() => {
          inFlightSearchRef.current = false
          setIsSearching(false)
          if (
            queuedSearchRef.current &&
            latestQueryRef.current &&
            latestQueryRef.current !== queryToSearch
          ) {
            queuedSearchRef.current = false
            setSearchKick((kick) => kick + 1)
          }
        })
    }, GLOBAL_SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [open, repository, searchKick, trimmedQuery])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const close = useCallback((): void => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return

    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      close()
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => window.removeEventListener('keydown', handleWindowKeyDown)
  }, [close, open])

  const handleQueryChange = useCallback((value: string): void => {
    setQuery(value)

    if (value.trim()) {
      setIsSearching(false)
      return
    }

    requestIdRef.current += 1
    queuedSearchRef.current = false
    setResults([])
    setSelectedIndex(0)
    setIsSearching(false)
    setError(undefined)
  }, [])

  const openSelectedResult = useCallback(
    (result: RepositorySearchResult | undefined): void => {
      if (!result) return
      onOpenResult(result)
      close()
    },
    [close, onOpenResult]
  )

  if (!open) return null

  return (
    <div className="global-search-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="global-search-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Search repository"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
            return
          }

          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setSelectedIndex((index) => (results.length ? (index + 1) % results.length : 0))
            return
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault()
            setSelectedIndex((index) =>
              results.length ? (index - 1 + results.length) % results.length : 0
            )
            return
          }

          if (event.key === 'Enter') {
            event.preventDefault()
            openSelectedResult(selectedResult)
          }
        }}
      >
        <button
          className="global-search-close"
          type="button"
          aria-label="Close search"
          onClick={close}
        >
          <X size={15} />
        </button>
        <div className="global-search-input-row">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Search repository"
            value={query}
            placeholder="Search files and content"
            onChange={(event) => handleQueryChange(event.target.value)}
          />
          {isSearching && <Loader2 className="spin" size={16} aria-label="Searching" />}
        </div>

        <div className="global-search-meta">
          <span>{repository.name}</span>
          <span>{sourceLabel}</span>
        </div>

        <div ref={listRef} className="global-search-results">
          {!trimmedQuery ? (
            <div className="global-search-empty">
              Type to search paths and text in this repository.
            </div>
          ) : error ? (
            <div className="global-search-empty">{error}</div>
          ) : !isSearching && results.length === 0 ? (
            <div className="global-search-empty">No results</div>
          ) : (
            results.map((result, index) => {
              const Icon = result.type === 'directory' ? Folder : FileText

              return (
                <button
                  key={`${result.matchType}:${result.path}`}
                  className={
                    index === selectedIndex ? 'global-search-result active' : 'global-search-result'
                  }
                  type="button"
                  onClick={() => openSelectedResult(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span className="global-search-result-body">
                    <span className="global-search-result-title">
                      <HighlightText text={result.name} query={trimmedQuery} />
                    </span>
                    <span className="global-search-result-path">
                      <HighlightText text={result.path} query={trimmedQuery} />
                    </span>
                    {result.snippet && (
                      <span className="global-search-result-snippet">
                        {result.lineNumber ? `L${result.lineNumber} ` : ''}
                        <HighlightText text={result.snippet} query={trimmedQuery} />
                      </span>
                    )}
                  </span>
                  <span className="global-search-result-kind">
                    {result.matchType === 'path' ? 'Path' : 'Text'}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <div className="global-search-footer">
          <span>↑↓ Navigate</span>
          <span>Enter Open</span>
          <span>Esc Close</span>
        </div>
      </section>
    </div>
  )
}
