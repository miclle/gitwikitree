import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'

export function PreviewSearchPopover({
  inputRef,
  query,
  matchCount,
  activeIndex,
  onQueryChange,
  onStepMatch,
  onClose
}: {
  inputRef: RefObject<HTMLInputElement | null>
  query: string
  matchCount: number
  activeIndex: number
  onQueryChange: (query: string) => void
  onStepMatch: (direction: -1 | 1) => void
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <form
      className="preview-search-popover"
      role="search"
      aria-label={t('search.currentTab')}
      onSubmit={(event) => {
        event.preventDefault()
        onStepMatch(1)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
          return
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          onStepMatch(event.shiftKey ? -1 : 1)
        }
      }}
    >
      <Search className="preview-search-icon" size={15} aria-hidden="true" />
      <input
        ref={inputRef}
        aria-label={t('search.currentTab')}
        value={query}
        placeholder={t('search.find')}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <span className="preview-search-count" aria-live="polite">
        {query.trim() ? (matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : '0/0') : '0/0'}
      </span>
      <button
        className="preview-search-button"
        type="button"
        aria-label={t('search.previousMatch')}
        disabled={matchCount === 0}
        onClick={() => onStepMatch(-1)}
      >
        <ChevronUp size={15} />
      </button>
      <button
        className="preview-search-button"
        type="button"
        aria-label={t('search.nextMatch')}
        disabled={matchCount === 0}
        onClick={() => onStepMatch(1)}
      >
        <ChevronDown size={15} />
      </button>
      <button
        className="preview-search-button"
        type="button"
        aria-label={t('search.closeFind')}
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </form>
  )
}
