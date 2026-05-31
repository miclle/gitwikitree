import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { isPrimaryClick } from '../mouse-events'
import { applyPreviewSearchHighlights } from '../preview-search'
import { usePreviewImageLightbox } from '../hooks/usePreviewImageLightbox'
import { CodePreview } from './CodePreview'
import { DirectoryListPreview } from './DirectoryListPreview'
import { HtmlPreview } from './HtmlPreview'
import { ImageLightbox } from './ImageLightbox'
import { ImagePreview, SvgPreview } from './ImagePreview'
import { MarkdownPreview } from './MarkdownPreview'
import { PdfPreview } from './PdfPreview'
import { UnsupportedPreview } from './UnsupportedPreview'
import type { MarkdownLinkContext, PreviewPayload } from '../../../shared/types'

export function PreviewContent({
  preview,
  pendingAnchor,
  searchQuery,
  activeSearchIndex,
  onSearchMatchCountChange,
  onPdfPageCountChange,
  onSelectPath,
  onOpenMarkdownLinkContextMenu,
  onMarkdownAnchorHandled
}: {
  preview: PreviewPayload
  pendingAnchor?: { path: string; hash: string; token: number }
  searchQuery: string
  activeSearchIndex: number
  onSearchMatchCountChange: (count: number) => void
  onPdfPageCountChange: (count: number | undefined) => void
  onSelectPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  onOpenMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  onMarkdownAnchorHandled: (token: number) => void
}): React.JSX.Element {
  const previewSearchRootRef = useRef<HTMLElement | null>(null)
  const [searchRootVersion, setSearchRootVersion] = useState(0)
  const { activeImageLightbox, openImageLightbox, closeImageLightbox, stepImageLightbox } =
    usePreviewImageLightbox({
      previewKind: preview.kind,
      previewPath: preview.path
    })
  const setPreviewSearchRoot = (element: HTMLElement | null): void => {
    previewSearchRootRef.current = element
  }
  const markPreviewSearchRootReady = useCallback((): void => {
    setSearchRootVersion((version) => version + 1)
  }, [])

  const handlePreviewImageClick =
    (container: HTMLElement) => (event: ReactMouseEvent<HTMLElement>) => {
      if (!isPrimaryClick(event)) return
      if (!(event.target instanceof Element)) return

      const image = event.target.closest<HTMLImageElement>('img')
      if (!image || !container.contains(image)) return

      event.preventDefault()
      openImageLightbox(image, container)
    }

  useEffect(() => {
    const container = previewSearchRootRef.current
    if (!container) {
      onSearchMatchCountChange(0)
      return
    }

    const matchCount = applyPreviewSearchHighlights({
      container,
      query: searchQuery,
      activeIndex: activeSearchIndex
    })
    onSearchMatchCountChange(matchCount)

    return () => {
      applyPreviewSearchHighlights({ container, query: '', activeIndex: -1 })
    }
  }, [activeSearchIndex, onSearchMatchCountChange, preview, searchQuery, searchRootVersion])

  const renderImageLightbox = (): React.JSX.Element | undefined => {
    if (!activeImageLightbox) return undefined

    return (
      <ImageLightbox
        key={`${activeImageLightbox.index}:${activeImageLightbox.images[activeImageLightbox.index]?.src ?? ''}`}
        images={activeImageLightbox.images}
        index={activeImageLightbox.index}
        onClose={closeImageLightbox}
        onStep={stepImageLightbox}
      />
    )
  }

  const withImageLightbox = (content: React.JSX.Element): React.JSX.Element => (
    <>
      {content}
      {renderImageLightbox()}
    </>
  )

  if (preview.kind === 'directory') {
    if (preview.readme) {
      return withImageLightbox(
        <MarkdownPreview
          content={preview.readme.content}
          sourcePath={preview.readme.path}
          previewPath={preview.path}
          pendingAnchor={pendingAnchor}
          markdownAssetDataUrls={preview.readme.markdownAssetDataUrls}
          markdownAssetPaths={preview.readme.markdownAssetPaths}
          markdownAssetAbsolutePaths={preview.readme.markdownAssetAbsolutePaths}
          rootRef={setPreviewSearchRoot}
          onContentReady={markPreviewSearchRootReady}
          onPreviewImageClick={(container, event) => handlePreviewImageClick(container)(event)}
          onSelectPath={onSelectPath}
          onOpenMarkdownLinkContextMenu={onOpenMarkdownLinkContextMenu}
          onMarkdownAnchorHandled={onMarkdownAnchorHandled}
        />
      )
    }

    return withImageLightbox(
      <DirectoryListPreview
        entries={preview.entries}
        rootRef={setPreviewSearchRoot}
        onSelectPath={onSelectPath}
      />
    )
  }

  if (preview.previewType === 'markdown' && preview.content !== undefined) {
    return withImageLightbox(
      <MarkdownPreview
        content={preview.content}
        sourcePath={preview.path}
        previewPath={preview.path}
        pendingAnchor={pendingAnchor}
        markdownAssetDataUrls={preview.markdownAssetDataUrls}
        markdownAssetPaths={preview.markdownAssetPaths}
        markdownAssetAbsolutePaths={preview.markdownAssetAbsolutePaths}
        rootRef={setPreviewSearchRoot}
        onContentReady={markPreviewSearchRootReady}
        onPreviewImageClick={(container, event) => handlePreviewImageClick(container)(event)}
        onSelectPath={onSelectPath}
        onOpenMarkdownLinkContextMenu={onOpenMarkdownLinkContextMenu}
        onMarkdownAnchorHandled={onMarkdownAnchorHandled}
      />
    )
  }

  if (preview.previewType === 'html' && preview.content !== undefined) {
    return withImageLightbox(
      <HtmlPreview
        content={preview.content}
        path={preview.path}
        rootRef={setPreviewSearchRoot}
        onContentReady={markPreviewSearchRootReady}
      />
    )
  }

  if (preview.previewType === 'pdf' && preview.dataUrl) {
    return withImageLightbox(
      <PdfPreview
        dataUrl={preview.dataUrl}
        name={preview.name}
        rootRef={setPreviewSearchRoot}
        onPageCountChange={onPdfPageCountChange}
      />
    )
  }

  if (preview.previewType === 'svg' && preview.content !== undefined) {
    return withImageLightbox(
      <SvgPreview
        name={preview.name}
        content={preview.content}
        rootRef={setPreviewSearchRoot}
        onPreviewImageClick={(container, event) => handlePreviewImageClick(container)(event)}
      />
    )
  }

  if (preview.previewType === 'image' && preview.dataUrl) {
    return withImageLightbox(
      <ImagePreview
        name={preview.name}
        src={preview.dataUrl}
        rootRef={setPreviewSearchRoot}
        onPreviewImageClick={(container, event) => handlePreviewImageClick(container)(event)}
      />
    )
  }

  if (preview.content !== undefined) {
    return withImageLightbox(
      <CodePreview
        content={preview.content}
        extension={preview.extension}
        rootRef={setPreviewSearchRoot}
      />
    )
  }

  return withImageLightbox(<UnsupportedPreview rootRef={setPreviewSearchRoot} />)
}
