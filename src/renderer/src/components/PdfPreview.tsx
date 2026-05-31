import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'
import { pdfDataUrlToBytes } from '../pdf-preview'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

type PdfPreviewStatus = 'loading' | 'ready' | 'error'

function createPdfPreviewPage(pageNumber: number, pageLabelText: string): HTMLElement {
  const pageElement = document.createElement('section')
  const pageLabel = document.createElement('div')

  pageElement.className = 'pdf-preview-page pending'
  pageElement.setAttribute('aria-label', pageLabelText)
  pageElement.dataset.pageNumber = String(pageNumber)
  pageLabel.className = 'pdf-preview-page-label'
  pageLabel.textContent = pageLabelText
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

export function PdfPreview({
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
  const { t } = useTranslation()
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

          const pageElement = createPdfPreviewPage(
            pageNumber,
            t('preview.page', { page: pageNumber })
          )
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
  }, [dataUrl, onPageCountChange, t])

  return (
    <div
      ref={setPdfPreviewRoot}
      className="pdf-preview"
      aria-label={t('preview.pdfLabel', { name })}
    >
      {status === 'loading' && (
        <div className="pdf-preview-state">
          <FileText size={32} />
          <strong>{t('preview.loadingPdf')}</strong>
        </div>
      )}
      {status === 'error' && (
        <div className="pdf-preview-state">
          <FileText size={32} />
          <strong>{t('preview.unavailable')}</strong>
          <span>{t('preview.pdfUnavailable')}</span>
        </div>
      )}
      <div className="pdf-preview-pages" />
    </div>
  )
}
