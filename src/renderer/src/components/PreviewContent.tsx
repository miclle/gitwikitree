import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref
} from 'react'
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
import { pdfDataUrlToBytes } from '../pdf-preview'
import {
  clampPreviewImagePan,
  collectPreviewImages,
  findPreviewImageIndex,
  getSteppedPreviewImageIndex,
  getSteppedPreviewImageZoom,
  getToggledPreviewImageZoom,
  type PreviewImage,
  type PreviewImagePan
} from '../preview-images'
import type { MarkdownLinkContext, PreviewPayload } from '../../../shared/types'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

let isMermaidInitialized = false
let mermaidDiagramId = 0
const renderingMermaidDiagrams = new WeakSet<HTMLElement>()

function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: [
      'data-copy-code',
      'data-markdown-link',
      'data-preview-image-src',
      'data-preview-image-absolute-src',
      'data-mermaid-source'
    ],
    ALLOW_DATA_ATTR: true
  })
}

async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  const diagrams = Array.from(
    container.querySelectorAll<HTMLElement>('.mermaid-preview[data-mermaid-source="true"]')
  ).filter(
    (diagram) =>
      !diagram.hasAttribute('data-mermaid-rendered') && !renderingMermaidDiagrams.has(diagram)
  )
  if (diagrams.length === 0) return

  for (const diagram of diagrams) {
    renderingMermaidDiagrams.add(diagram)
    diagram.setAttribute('data-mermaid-rendering', 'true')
  }

  try {
    const { default: mermaid } = await import('mermaid')

    if (!isMermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default'
      })
      isMermaidInitialized = true
    }

    await Promise.all(
      diagrams.map(async (diagram) => {
        const source = diagram.textContent?.trim()
        if (!source) return

        const diagramId = `mermaid-preview-${(mermaidDiagramId += 1)}`

        try {
          const { svg, bindFunctions } = await mermaid.render(diagramId, source)
          if (!diagram.isConnected) return

          diagram.innerHTML = svg
          diagram.setAttribute('data-mermaid-rendered', 'true')
          diagram.removeAttribute('data-mermaid-error')
          diagram.removeAttribute('title')
          bindFunctions?.(diagram)
        } catch (error) {
          if (!diagram.isConnected) return

          diagram.setAttribute('data-mermaid-error', 'true')
          diagram.title =
            error instanceof Error ? error.message : 'Unable to render Mermaid diagram'
        }
      })
    )
  } finally {
    for (const diagram of diagrams) {
      renderingMermaidDiagrams.delete(diagram)
      diagram.removeAttribute('data-mermaid-rendering')
    }
  }
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

type PdfPreviewStatus = 'loading' | 'ready' | 'error'

function createPdfPreviewPage(pageNumber: number): HTMLElement {
  const pageElement = document.createElement('section')
  const pageLabel = document.createElement('div')

  pageElement.className = 'pdf-preview-page pending'
  pageElement.setAttribute('aria-label', `Page ${pageNumber}`)
  pageElement.dataset.pageNumber = String(pageNumber)
  pageLabel.className = 'pdf-preview-page-label'
  pageLabel.textContent = `Page ${pageNumber}`
  pageElement.append(pageLabel)

  return pageElement
}

function appendRenderedPdfPage(pageElement: HTMLElement, page: PDFPageProxy): RenderTask {
  const viewport = page.getViewport({ scale: 1.25 })
  const outputScale = window.devicePixelRatio || 1
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) throw new Error('Canvas rendering is unavailable')

  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${viewport.width}px`
  context.setTransform(outputScale, 0, 0, outputScale, 0, 0)
  pageElement.append(canvas)
  pageElement.classList.remove('pending')

  return page.render({ canvas, canvasContext: context, viewport })
}

function PdfPreview({
  dataUrl,
  name,
  rootRef,
  onPageCountChange
}: {
  dataUrl: string
  name: string
  rootRef: (element: HTMLElement | null) => void
  onPageCountChange: (count: number | undefined) => void
}): React.JSX.Element {
  const pagesRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<PdfPreviewStatus>('loading')
  const setPdfPreviewRoot = (element: HTMLDivElement | null): void => {
    pagesRef.current = element?.querySelector<HTMLDivElement>('.pdf-preview-pages') ?? null
    rootRef(element)
  }

  useEffect(() => {
    const pagesContainer = pagesRef.current
    if (!pagesContainer) return

    let isCancelled = false
    const renderTasks: RenderTask[] = []
    let loadingTask:
      | { promise: Promise<PDFDocumentProxy>; destroy: () => Promise<void> }
      | undefined
    let pageObserver: IntersectionObserver | undefined
    pagesContainer.replaceChildren()
    setStatus('loading')
    onPageCountChange(undefined)

    const renderPdf = async (): Promise<void> => {
      try {
        const pdfjs = await import('pdfjs-dist')
        if (isCancelled) return

        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const bytes = pdfDataUrlToBytes(dataUrl)
        loadingTask = pdfjs.getDocument({ data: bytes })
        const pdf = await loadingTask.promise
        if (isCancelled) return

        onPageCountChange(pdf.numPages)

        const renderedPages = new Set<number>()
        const renderPage = async (pageNumber: number, pageElement: HTMLElement): Promise<void> => {
          if (isCancelled || renderedPages.has(pageNumber)) return

          renderedPages.add(pageNumber)
          const page = await pdf.getPage(pageNumber)
          if (isCancelled) return

          const renderTask = appendRenderedPdfPage(pageElement, page)
          renderTasks.push(renderTask)
          await renderTask.promise
          if (!isCancelled && pageNumber === 1) setStatus('ready')
        }

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (isCancelled) return

          const pageElement = createPdfPreviewPage(pageNumber)
          pagesContainer.append(pageElement)

          if (pageNumber === 1) {
            await renderPage(pageNumber, pageElement)
          }
        }

        if (isCancelled) return

        pageObserver = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue

              const pageNumber = Number(entry.target.dataset.pageNumber)
              pageObserver?.unobserve(entry.target)
              void renderPage(pageNumber, entry.target)
            }
          },
          { root: pagesContainer, rootMargin: '900px 0px' }
        )

        for (const pageElement of pagesContainer.querySelectorAll<HTMLElement>(
          '.pdf-preview-page.pending'
        )) {
          pageObserver.observe(pageElement)
        }
      } catch {
        if (!isCancelled) {
          pagesContainer.replaceChildren()
          onPageCountChange(undefined)
          setStatus('error')
        }
      }
    }

    void renderPdf()

    return () => {
      isCancelled = true
      for (const renderTask of renderTasks) {
        renderTask.cancel()
      }
      pageObserver?.disconnect()
      void loadingTask?.destroy()
    }
  }, [dataUrl, onPageCountChange])

  return (
    <div ref={setPdfPreviewRoot} className="pdf-preview" aria-label={`PDF preview: ${name}`}>
      {status === 'loading' && (
        <div className="pdf-preview-state">
          <FileText size={32} />
          <strong>Loading PDF</strong>
        </div>
      )}
      {status === 'error' && (
        <div className="pdf-preview-state">
          <FileText size={32} />
          <strong>Preview unavailable</strong>
          <span>This PDF could not be rendered.</span>
        </div>
      )}
      <div className="pdf-preview-pages" />
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
const RESET_IMAGE_LIGHTBOX_PAN: PreviewImagePan = { x: 0, y: 0 }

type ImageLightboxDragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startPan: PreviewImagePan
}

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
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<ImageLightboxDragState | undefined>(undefined)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<PreviewImagePan>(RESET_IMAGE_LIGHTBOX_PAN)
  const [isDragging, setIsDragging] = useState(false)
  const image = images[index]
  if (!image) return undefined

  const imageLabel = image.alt || image.title || 'Preview image'
  const canNavigate = images.length > 1
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 1
  const zoomLabel = `${Math.round(normalizedZoom * 100)}%`
  const isPannable = normalizedZoom > 1
  const imageClassName = [
    'image-lightbox-image',
    isPannable ? 'is-pannable' : '',
    isDragging ? 'is-dragging' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const clampImageLightboxPan = (
    nextPan: PreviewImagePan,
    nextZoom = normalizedZoom
  ): PreviewImagePan =>
    clampPreviewImagePan({
      pan: nextPan,
      zoom: nextZoom,
      imageWidth: imageRef.current?.clientWidth ?? 0,
      imageHeight: imageRef.current?.clientHeight ?? 0,
      stageWidth: stageRef.current?.clientWidth ?? 0,
      stageHeight: stageRef.current?.clientHeight ?? 0
    })
  const updateImageLightboxZoom = (updater: (currentZoom: number) => number): void => {
    const nextZoom = updater(normalizedZoom)

    setZoom(nextZoom)
    setPan((currentPan) =>
      nextZoom <= 1 ? RESET_IMAGE_LIGHTBOX_PAN : clampImageLightboxPan(currentPan, nextZoom)
    )
  }
  const handleImagePointerDown = (event: ReactPointerEvent<HTMLImageElement>): void => {
    if (!isPannable) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan
    }
    setIsDragging(true)
  }
  const handleImagePointerMove = (event: ReactPointerEvent<HTMLImageElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    setPan(
      clampImageLightboxPan({
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY
      })
    )
  }
  const handleImagePointerEnd = (event: ReactPointerEvent<HTMLImageElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = undefined
    setIsDragging(false)
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
        ref={stageRef}
        className="image-lightbox-stage"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          updateImageLightboxZoom((currentZoom) =>
            getSteppedPreviewImageZoom(
              currentZoom,
              event.deltaY < 0 ? IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP : -IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP
            )
          )
        }}
      >
        <img
          ref={imageRef}
          alt={imageLabel}
          className={imageClassName}
          src={image.src}
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${normalizedZoom})` }}
          title="Scroll to zoom. Double-click to toggle zoom."
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            updateImageLightboxZoom(getToggledPreviewImageZoom)
          }}
          onPointerDown={handleImagePointerDown}
          onPointerMove={handleImagePointerMove}
          onPointerUp={handleImagePointerEnd}
          onPointerCancel={handleImagePointerEnd}
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

    if (element) {
      void renderMermaidDiagrams(element)
    }
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
    const container = markdownBodyRef.current
    if (!container) return

    let isCancelled = false
    void renderMermaidDiagrams(container).then(() => {
      if (!isCancelled) setSearchRootVersion((version) => version + 1)
    })

    return () => {
      isCancelled = true
    }
  }, [preview])

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
