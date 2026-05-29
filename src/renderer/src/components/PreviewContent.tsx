import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type Ref } from 'react'
import DOMPurify from 'dompurify'
import { ChevronLeft, ChevronRight, FileText, X } from 'lucide-react'
import {
  getMarkdownPreview,
  isExternalLink,
  markdownHeadingId,
  markdownToHtml
} from '../markdown-preview'
import { highlightCodeBlock, languageForExtension } from '../code-highlight'
import { createMarkdownLinkTarget } from '../markdown-link-context'
import { isPrimaryClick, shouldHandleNavigationClick } from '../mouse-events'
import { iconForNode, shouldOpenInNewTab } from '../app-utils'
import { applyPreviewSearchHighlights } from '../preview-search'
import {
  collectPreviewImages,
  findPreviewImageIndex,
  getSteppedPreviewImageIndex,
  getSteppedPreviewImageZoom,
  getToggledPreviewImageZoom,
  type PreviewImage
} from '../preview-images'
import type { MarkdownLinkContext, PreviewPayload } from '../../../shared/types'

function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: [
      'data-copy-code',
      'data-markdown-link',
      'data-preview-image-src',
      'data-preview-image-absolute-src'
    ],
    ALLOW_DATA_ATTR: true
  })
}

function renderMarkdownHtml(
  content: string,
  markdownAssetDataUrls?: Record<string, string>,
  markdownAssetPaths?: Record<string, string>,
  markdownAssetAbsolutePaths?: Record<string, string>
): string {
  return sanitizeMarkdownHtml(
    markdownToHtml(content, {
      resolveImageSrc: (href) => markdownAssetDataUrls?.[href],
      resolveImagePath: (href) => markdownAssetPaths?.[href],
      resolveImageAbsolutePath: (href) => markdownAssetAbsolutePaths?.[href]
    })
  )
}

function CodePreview({
  content,
  extension,
  rootRef
}: {
  content: string
  extension: string
  rootRef: Ref<HTMLDivElement>
}): React.JSX.Element {
  const lineCount = Math.max(1, content.split('\n').length)
  const language = languageForExtension(extension)

  return (
    <div ref={rootRef} className="code-preview-shell" aria-label="Source code">
      <pre className="code-line-gutter" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => index + 1).join('\n')}
      </pre>
      <pre className="code-source">
        <code
          className={language ? `hljs language-${language}` : 'hljs'}
          dangerouslySetInnerHTML={{ __html: highlightCodeBlock(content, language) || ' ' }}
        />
      </pre>
    </div>
  )
}

type ImageLightboxState = {
  images: PreviewImage[]
  index: number
  previewKind: PreviewPayload['kind']
  previewPath: string
}

const IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP = 0.25

function ImageLightbox({
  images,
  index,
  onClose,
  onStep
}: {
  images: PreviewImage[]
  index: number
  onClose: () => void
  onStep: (delta: number) => void
}): React.JSX.Element | undefined {
  const [zoom, setZoom] = useState(1)
  const image = images[index]
  if (!image) return undefined

  const imageLabel = image.alt || image.title || 'Preview image'
  const canNavigate = images.length > 1
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 1
  const zoomLabel = `${Math.round(normalizedZoom * 100)}%`
  const setImageLightboxZoom = (updater: (currentZoom: number) => number): void => {
    setZoom((currentZoom) => updater(Number.isFinite(currentZoom) ? currentZoom : 1))
  }

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div className="image-lightbox-topbar" onClick={(event) => event.stopPropagation()}>
        <div className="image-lightbox-meta">
          <span className="image-lightbox-title">{imageLabel}</span>
          {canNavigate && (
            <span className="image-lightbox-count">
              {index + 1} / {images.length}
            </span>
          )}
          <span className="image-lightbox-count">{zoomLabel}</span>
        </div>
        <button type="button" aria-label="Close image preview" title="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {canNavigate && (
        <button
          type="button"
          className="image-lightbox-nav previous"
          aria-label="Previous image"
          title="Previous image"
          onClick={(event) => {
            event.stopPropagation()
            onStep(-1)
          }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <div
        className="image-lightbox-stage"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setImageLightboxZoom((currentZoom) =>
            getSteppedPreviewImageZoom(
              currentZoom,
              event.deltaY < 0 ? IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP : -IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP
            )
          )
        }}
      >
        <img
          alt={imageLabel}
          className="image-lightbox-image"
          src={image.src}
          style={{ transform: `scale(${normalizedZoom})` }}
          title="Scroll to zoom. Double-click to toggle zoom."
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setImageLightboxZoom(getToggledPreviewImageZoom)
          }}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {canNavigate && (
        <button
          type="button"
          className="image-lightbox-nav next"
          aria-label="Next image"
          title="Next image"
          onClick={(event) => {
            event.stopPropagation()
            onStep(1)
          }}
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  )
}

export function PreviewContent({
  preview,
  pendingAnchor,
  searchQuery,
  activeSearchIndex,
  onSearchMatchCountChange,
  onSelectPath,
  onOpenMarkdownLinkContextMenu,
  onMarkdownAnchorHandled
}: {
  preview: PreviewPayload
  pendingAnchor?: { path: string; hash: string; token: number }
  searchQuery: string
  activeSearchIndex: number
  onSearchMatchCountChange: (count: number) => void
  onSelectPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  onOpenMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  onMarkdownAnchorHandled: (token: number) => void
}): React.JSX.Element {
  const markdownBodyRef = useRef<HTMLElement | null>(null)
  const previewSearchRootRef = useRef<HTMLElement | null>(null)
  const [searchRootVersion, setSearchRootVersion] = useState(0)
  const [imageLightbox, setImageLightbox] = useState<ImageLightboxState | undefined>()
  const activeImageLightbox =
    imageLightbox?.previewKind === preview.kind && imageLightbox.previewPath === preview.path
      ? imageLightbox
      : undefined
  const setPreviewSearchRoot = (element: HTMLElement | null): void => {
    previewSearchRootRef.current = element
  }
  const setMarkdownPreviewRoot = (element: HTMLElement | null): void => {
    markdownBodyRef.current = element
    previewSearchRootRef.current = element
  }
  const setHtmlPreviewRoot = (element: HTMLIFrameElement | null): void => {
    previewSearchRootRef.current = element?.contentDocument?.body ?? null
  }
  const setCopyButtonState = (
    button: HTMLButtonElement,
    state: 'copied' | 'failed',
    label: string,
    resetDelay = 1200
  ): void => {
    button.dataset.copyState = state
    button.textContent = label
    button.setAttribute('aria-label', label === 'Copied' ? 'Code copied' : 'Copy failed')

    window.setTimeout(() => {
      button.dataset.copyState = 'idle'
      button.textContent = 'Copy'
      button.setAttribute('aria-label', 'Copy code')
    }, resetDelay)
  }

  const handleMarkdownCodeCopy = async (button: HTMLButtonElement): Promise<void> => {
    const code = button
      .closest('.markdown-code-block')
      ?.querySelector<HTMLElement>('pre code')?.textContent

    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setCopyButtonState(button, 'copied', 'Copied')
    } catch {
      setCopyButtonState(button, 'failed', 'Failed')
    }
  }

  const scrollToMarkdownAnchor = (hash: string, container: HTMLElement): void => {
    if (!hash) return

    const escapedAnchor = CSS.escape(hash)
    const target = container.querySelector<HTMLElement>(
      `[id="${escapedAnchor}"], [name="${escapedAnchor}"]`
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const closeImageLightbox = (): void => {
    setImageLightbox(undefined)
  }

  const stepImageLightbox = (delta: number): void => {
    setImageLightbox((current) =>
      current
        ? {
            ...current,
            index: getSteppedPreviewImageIndex(current.index, current.images.length, delta)
          }
        : current
    )
  }

  const openImageLightbox = (image: HTMLImageElement, container: HTMLElement): void => {
    const images = collectPreviewImages(container.querySelectorAll('img'))
    if (images.length === 0) return

    setImageLightbox({
      images,
      index: findPreviewImageIndex(images, image.src),
      previewKind: preview.kind,
      previewPath: preview.path
    })
  }

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
    if (!pendingAnchor || pendingAnchor.path !== preview.path || !markdownBodyRef.current) return

    scrollToMarkdownAnchor(pendingAnchor.hash, markdownBodyRef.current)
    onMarkdownAnchorHandled(pendingAnchor.token)
  }, [onMarkdownAnchorHandled, pendingAnchor, preview.path])

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

  useEffect(() => {
    if (!activeImageLightbox) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeImageLightbox()
        return
      }

      if (event.key === 'ArrowLeft' && activeImageLightbox.images.length > 1) {
        event.preventDefault()
        event.stopPropagation()
        stepImageLightbox(-1)
        return
      }

      if (event.key === 'ArrowRight' && activeImageLightbox.images.length > 1) {
        event.preventDefault()
        event.stopPropagation()
        stepImageLightbox(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeImageLightbox])

  const handleMarkdownLinkClick = (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return

    const copyButton = event.target.closest<HTMLButtonElement>('button[data-copy-code]')
    if (copyButton && event.currentTarget.contains(copyButton)) {
      if (!isPrimaryClick(event)) return
      event.preventDefault()
      void handleMarkdownCodeCopy(copyButton)
      return
    }

    const link = event.target.closest<HTMLAnchorElement>('a[data-markdown-link]')
    if (!link || !event.currentTarget.contains(link)) return
    if (!shouldHandleNavigationClick(event)) return

    const href = link.getAttribute('href') ?? ''
    event.preventDefault()

    const target = createMarkdownLinkTarget({
      href,
      sourcePath,
      previewPath: preview.path
    })
    if (!target) return

    if (target.kind === 'anchor' && target.hash) {
      scrollToMarkdownAnchor(target.hash, event.currentTarget)
      return
    }

    if (isExternalLink(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    if (target.targetPath !== undefined) {
      onSelectPath(target.targetPath, shouldOpenInNewTab(event), target.hash)
    }
  }

  const handleMarkdownPreviewClick =
    (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
      handlePreviewImageClick(event.currentTarget)(event)
      if (event.defaultPrevented) return

      handleMarkdownLinkClick(sourcePath)(event)
    }

  const handleMarkdownLinkContextMenu =
    (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) return
      if (event.target.closest('img')) return

      const link = event.target.closest<HTMLAnchorElement>('a[data-markdown-link]')
      if (!link || !event.currentTarget.contains(link)) return

      const target = createMarkdownLinkTarget({
        href: link.getAttribute('href') ?? '',
        sourcePath,
        previewPath: preview.path
      })
      if (!target) return

      event.preventDefault()
      void onOpenMarkdownLinkContextMenu(target)
    }

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
      const markdownPreview = getMarkdownPreview(preview.readme.content)

      return withImageLightbox(
        <article
          ref={setMarkdownPreviewRoot}
          className="markdown-body"
          onAuxClick={handleMarkdownLinkClick(preview.readme.path)}
          onClick={handleMarkdownPreviewClick(preview.readme.path)}
          onContextMenu={handleMarkdownLinkContextMenu(preview.readme.path)}
        >
          {markdownPreview.title && (
            <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
          )}
          <div
            dangerouslySetInnerHTML={{
              __html: renderMarkdownHtml(
                markdownPreview.content,
                preview.readme.markdownAssetDataUrls,
                preview.readme.markdownAssetPaths,
                preview.readme.markdownAssetAbsolutePaths
              )
            }}
          />
        </article>
      )
    }

    return withImageLightbox(
      <div ref={setPreviewSearchRoot} className="directory-list">
        {(preview.entries ?? []).map((entry) => (
          <button
            key={entry.path}
            type="button"
            onAuxClick={(event) => {
              if (!shouldOpenInNewTab(event)) return
              event.preventDefault()
              onSelectPath(entry.path, true)
            }}
            onClick={(event) => onSelectPath(entry.path, shouldOpenInNewTab(event))}
          >
            {iconForNode(entry)}
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    )
  }

  if (preview.previewType === 'markdown' && preview.content !== undefined) {
    const markdownPreview = getMarkdownPreview(preview.content)

    return withImageLightbox(
      <article
        ref={setMarkdownPreviewRoot}
        className="markdown-body"
        onAuxClick={handleMarkdownLinkClick(preview.path)}
        onClick={handleMarkdownPreviewClick(preview.path)}
        onContextMenu={handleMarkdownLinkContextMenu(preview.path)}
      >
        {markdownPreview.title && (
          <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
        )}
        <div
          dangerouslySetInnerHTML={{
            __html: renderMarkdownHtml(
              markdownPreview.content,
              preview.markdownAssetDataUrls,
              preview.markdownAssetPaths,
              preview.markdownAssetAbsolutePaths
            )
          }}
        />
      </article>
    )
  }

  if (preview.previewType === 'html' && preview.content !== undefined) {
    return withImageLightbox(
      <iframe
        ref={setHtmlPreviewRoot}
        className="html-preview"
        title={preview.path}
        sandbox="allow-same-origin"
        srcDoc={preview.content}
        onLoad={(event) => {
          setHtmlPreviewRoot(event.currentTarget)
          setSearchRootVersion((version) => version + 1)
        }}
      />
    )
  }

  if (preview.previewType === 'svg' && preview.content !== undefined) {
    return withImageLightbox(
      <div
        ref={setPreviewSearchRoot}
        className="image-preview"
        onClick={(event) => handlePreviewImageClick(event.currentTarget)(event)}
      >
        <img
          alt={preview.name}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.content)}`}
        />
      </div>
    )
  }

  if (preview.previewType === 'image' && preview.dataUrl) {
    return withImageLightbox(
      <div
        ref={setPreviewSearchRoot}
        className="image-preview"
        onClick={(event) => handlePreviewImageClick(event.currentTarget)(event)}
      >
        <img alt={preview.name} src={preview.dataUrl} />
      </div>
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

  return withImageLightbox(
    <div ref={setPreviewSearchRoot} className="unsupported-preview">
      <FileText size={32} />
      <strong>Preview unavailable</strong>
      <span>This file type is not rendered yet.</span>
    </div>
  )
}
