export function countSearchMatches(text: string, query: string): number {
  return findSearchMatchRanges(text, query).length
}

export function findSearchMatchRanges(
  text: string,
  query: string
): Array<{ start: number; end: number }> {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return []

  const normalizedText = text.toLocaleLowerCase()
  const ranges: Array<{ start: number; end: number }> = []
  let index = normalizedText.indexOf(normalizedQuery)

  while (index !== -1) {
    ranges.push({ start: index, end: index + normalizedQuery.length })
    index = normalizedText.indexOf(normalizedQuery, index + normalizedQuery.length)
  }

  return ranges
}

export function getSteppedSearchIndex({
  currentIndex,
  matchCount,
  direction
}: {
  currentIndex: number
  matchCount: number
  direction: -1 | 1
}): number {
  if (matchCount <= 0) return -1
  if (currentIndex < 0) return direction > 0 ? 0 : matchCount - 1

  return (currentIndex + direction + matchCount) % matchCount
}

export function getSelectedPreviewSearchText(
  selection: Selection | null,
  previewRoot: Pick<HTMLElement, 'contains'> | null
): string | undefined {
  const text = selection?.toString().trim()
  if (!selection || !previewRoot || !text || selection.rangeCount === 0) return undefined

  const range = selection.getRangeAt(0)
  if (!previewRoot.contains(range.commonAncestorContainer)) return undefined

  return text
}

function clearSearchHighlights(container: HTMLElement): void {
  const marks = Array.from(container.querySelectorAll<HTMLElement>('mark.preview-search-match'))

  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue

    parent.replaceChild(container.ownerDocument.createTextNode(mark.textContent ?? ''), mark)
    parent.normalize()
  }
}

function ensureSearchHighlightStyle(container: HTMLElement): void {
  const doc = container.ownerDocument
  if (doc.getElementById('preview-search-highlight-style')) return

  const style = doc.createElement('style')
  style.id = 'preview-search-highlight-style'
  style.textContent = `
    .preview-search-match {
      border-radius: 2px;
      color: inherit;
      background: #fff1a7;
      box-shadow: 0 0 0 1px rgba(154, 103, 0, 0.12);
    }

    .preview-search-match.active {
      background: #f7c948;
      box-shadow: 0 0 0 1px rgba(154, 103, 0, 0.32);
    }
  `
  doc.head.append(style)
}

function shouldSearchTextNode(node: Text, container: HTMLElement): boolean {
  if (!node.textContent?.trim()) return false

  const parent = node.parentElement
  if (!parent || !container.contains(parent)) return false

  return !parent.closest(
    'mark.preview-search-match, .code-line-gutter, .markdown-code-copy, [aria-hidden="true"]'
  )
}

export function applyPreviewSearchHighlights({
  container,
  query,
  activeIndex
}: {
  container: HTMLElement
  query: string
  activeIndex: number
}): number {
  clearSearchHighlights(container)

  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return 0

  ensureSearchHighlightStyle(container)

  const doc = container.ownerDocument
  const nodeFilter = doc.defaultView?.NodeFilter
  const textNodeFilter = nodeFilter?.SHOW_TEXT ?? 4
  const filterAccept = nodeFilter?.FILTER_ACCEPT ?? 1
  const filterReject = nodeFilter?.FILTER_REJECT ?? 2
  const walker = doc.createTreeWalker(container, textNodeFilter, {
    acceptNode(node) {
      return shouldSearchTextNode(node as Text, container) ? filterAccept : filterReject
    }
  })
  const textNodes: Array<{ node: Text; start: number; end: number }> = []
  let fullText = ''

  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const text = node.textContent ?? ''
    textNodes.push({ node, start: fullText.length, end: fullText.length + text.length })
    fullText += text
  }

  const matchRanges = findSearchMatchRanges(fullText, normalizedQuery)
  let activeMatch: HTMLElement | undefined

  for (const { node, start, end } of textNodes) {
    const overlappingRanges = matchRanges
      .map((range, matchIndex) => ({ ...range, matchIndex }))
      .filter((range) => range.start < end && range.end > start)
    if (!overlappingRanges.length) continue

    const text = node.textContent ?? ''
    const fragment = doc.createDocumentFragment()
    let cursor = 0

    for (const range of overlappingRanges) {
      const localStart = Math.max(0, range.start - start)
      const localEnd = Math.min(text.length, range.end - start)

      if (localStart > cursor) {
        fragment.append(doc.createTextNode(text.slice(cursor, localStart)))
      }

      const mark = doc.createElement('mark')
      mark.className =
        range.matchIndex === activeIndex ? 'preview-search-match active' : 'preview-search-match'
      mark.textContent = text.slice(localStart, localEnd)
      fragment.append(mark)

      if (range.matchIndex === activeIndex && !activeMatch) activeMatch = mark
      cursor = localEnd
    }

    if (cursor < text.length) fragment.append(doc.createTextNode(text.slice(cursor)))
    node.replaceWith(fragment)
  }

  activeMatch?.scrollIntoView({ block: 'center', inline: 'nearest' })

  return matchRanges.length
}
