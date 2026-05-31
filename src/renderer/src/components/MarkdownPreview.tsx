import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import {
  getMarkdownPreview,
  isExternalLink,
  markdownHeadingId,
  markdownToHtml
} from '../markdown-preview'
import { createMarkdownLinkTarget } from '../markdown-link-context'
import { isPrimaryClick, shouldHandleNavigationClick } from '../mouse-events'
import { shouldOpenInNewTab } from '../app-utils'
import type { MarkdownLinkContext } from '../../../shared/types'

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

function renderMarkdownHtml({
  content,
  markdownAssetDataUrls,
  markdownAssetPaths,
  markdownAssetAbsolutePaths
}: {
  content: string
  markdownAssetDataUrls?: Record<string, string>
  markdownAssetPaths?: Record<string, string>
  markdownAssetAbsolutePaths?: Record<string, string>
}): string {
  return sanitizeMarkdownHtml(
    markdownToHtml(content, {
      resolveImageSrc: (href) => markdownAssetDataUrls?.[href],
      resolveImagePath: (href) => markdownAssetPaths?.[href],
      resolveImageAbsolutePath: (href) => markdownAssetAbsolutePaths?.[href]
    })
  )
}

function scrollToMarkdownAnchor(hash: string, container: HTMLElement): void {
  if (!hash) return

  const escapedAnchor = CSS.escape(hash)
  const target = container.querySelector<HTMLElement>(
    `[id="${escapedAnchor}"], [name="${escapedAnchor}"]`
  )
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export function MarkdownPreview({
  content,
  sourcePath,
  previewPath,
  pendingAnchor,
  markdownAssetDataUrls,
  markdownAssetPaths,
  markdownAssetAbsolutePaths,
  rootRef,
  onContentReady,
  onPreviewImageClick,
  onSelectPath,
  onOpenMarkdownLinkContextMenu,
  onMarkdownAnchorHandled
}: {
  content: string
  sourcePath: string
  previewPath: string
  pendingAnchor?: { path: string; hash: string; token: number }
  markdownAssetDataUrls?: Record<string, string>
  markdownAssetPaths?: Record<string, string>
  markdownAssetAbsolutePaths?: Record<string, string>
  rootRef: (element: HTMLElement | null) => void
  onContentReady: () => void
  onPreviewImageClick: (container: HTMLElement, event: ReactMouseEvent<HTMLElement>) => void
  onSelectPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  onOpenMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  onMarkdownAnchorHandled: (token: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const markdownBodyRef = useRef<HTMLElement | null>(null)
  const markdownPreview = getMarkdownPreview(content)

  const setMarkdownPreviewRoot = (element: HTMLElement | null): void => {
    markdownBodyRef.current = element
    rootRef(element)

    if (element) {
      void renderMermaidDiagrams(element)
    }
  }

  const localizeMarkdownCodeCopyButtons = useCallback(
    (container: HTMLElement): void => {
      for (const button of container.querySelectorAll<HTMLButtonElement>(
        'button[data-copy-code]'
      )) {
        if (button.dataset.copyState && button.dataset.copyState !== 'idle') continue
        button.dataset.copyState = 'idle'
        button.textContent = t('preview.copy')
        button.setAttribute('aria-label', t('preview.copyCode'))
        button.title = t('preview.copyCode')
      }
    },
    [t]
  )

  const setCopyButtonState = (
    button: HTMLButtonElement,
    state: 'copied' | 'failed',
    label: string,
    resetDelay = 1200
  ): void => {
    button.dataset.copyState = state
    button.textContent = label
    button.setAttribute(
      'aria-label',
      label === t('preview.copied') ? t('preview.codeCopied') : t('preview.copyFailed')
    )

    window.setTimeout(() => {
      button.dataset.copyState = 'idle'
      button.textContent = t('preview.copy')
      button.setAttribute('aria-label', t('preview.copyCode'))
    }, resetDelay)
  }

  const handleMarkdownCodeCopy = async (button: HTMLButtonElement): Promise<void> => {
    const code = button
      .closest('.markdown-code-block')
      ?.querySelector<HTMLElement>('pre code')?.textContent

    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setCopyButtonState(button, 'copied', t('preview.copied'))
    } catch {
      setCopyButtonState(button, 'failed', t('preview.failed'))
    }
  }

  const handleMarkdownLinkClick = (event: ReactMouseEvent<HTMLElement>): void => {
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
      previewPath
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

  const handleMarkdownPreviewClick = (event: ReactMouseEvent<HTMLElement>): void => {
    onPreviewImageClick(event.currentTarget, event)
    if (event.defaultPrevented) return

    handleMarkdownLinkClick(event)
  }

  const handleMarkdownLinkContextMenu = (event: ReactMouseEvent<HTMLElement>): void => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('img')) return

    const link = event.target.closest<HTMLAnchorElement>('a[data-markdown-link]')
    if (!link || !event.currentTarget.contains(link)) return

    const target = createMarkdownLinkTarget({
      href: link.getAttribute('href') ?? '',
      sourcePath,
      previewPath
    })
    if (!target) return

    event.preventDefault()
    void onOpenMarkdownLinkContextMenu(target)
  }

  useEffect(() => {
    if (!pendingAnchor || pendingAnchor.path !== previewPath || !markdownBodyRef.current) return

    scrollToMarkdownAnchor(pendingAnchor.hash, markdownBodyRef.current)
    onMarkdownAnchorHandled(pendingAnchor.token)
  }, [onMarkdownAnchorHandled, pendingAnchor, previewPath])

  useEffect(() => {
    const container = markdownBodyRef.current
    if (!container) return

    localizeMarkdownCodeCopyButtons(container)

    let isCancelled = false
    void renderMermaidDiagrams(container).then(() => {
      if (!isCancelled) onContentReady()
    })

    return () => {
      isCancelled = true
    }
  }, [content, localizeMarkdownCodeCopyButtons, onContentReady])

  return (
    <article
      ref={setMarkdownPreviewRoot}
      className="markdown-body"
      onAuxClick={handleMarkdownLinkClick}
      onClick={handleMarkdownPreviewClick}
      onContextMenu={handleMarkdownLinkContextMenu}
    >
      {markdownPreview.title && (
        <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
      )}
      <div
        dangerouslySetInnerHTML={{
          __html: renderMarkdownHtml({
            content: markdownPreview.content,
            markdownAssetDataUrls,
            markdownAssetPaths,
            markdownAssetAbsolutePaths
          })
        }}
      />
    </article>
  )
}
