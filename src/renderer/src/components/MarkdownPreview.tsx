import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import DOMPurify from 'dompurify'
import {
  getMarkdownPreview,
  isExternalLink,
  isMarpMarkdown,
  marpMarkdownToHtml,
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

function sanitizeMarpHtml(html: string): string {
  return html
}

function getMarpSlideMaxHeight(container: HTMLElement): number {
  const style = window.getComputedStyle(container)
  const verticalPadding =
    Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
  const slideBreathingRoom = 40

  return Math.max(240, container.clientHeight - verticalPadding - slideBreathingRoom)
}

function getMarpSlideAspectRatio(html: string | undefined): number {
  const viewBox = html?.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/)
  const width = viewBox ? Number.parseFloat(viewBox[1]) : 16
  const height = viewBox ? Number.parseFloat(viewBox[2]) : 9

  return width > 0 && height > 0 ? width / height : 16 / 9
}

function getMarpSlideMaxWidth(container: HTMLElement, html: string | undefined): number {
  return getMarpSlideMaxHeight(container) * getMarpSlideAspectRatio(html)
}

function findEventPathElement<T extends Element>(
  event: ReactMouseEvent<HTMLElement>,
  selector: string
): T | undefined {
  const path = event.nativeEvent.composedPath()

  for (const pathItem of path) {
    if (!(pathItem instanceof Element)) continue

    const match = pathItem.closest<T>(selector)
    if (match && path.includes(match)) return match
  }

  return undefined
}

function getPreviewImageContainer(image: HTMLImageElement, fallback: HTMLElement): ParentNode {
  const root = image.getRootNode()

  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot ? root : fallback
}

function MarpPreviewContent({
  rendered,
  onReady
}: {
  rendered: { html: string; css: string }
  onReady: () => void
}): React.JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
    shadowRoot.innerHTML = `
      <style>${rendered.css}</style>
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .marpit {
          display: grid;
          grid-template-columns: minmax(0, 100%);
          justify-content: center;
          align-content: start;
          gap: 20px;
          width: 100%;
        }

        .marpit > svg {
          display: block;
          width: min(100%, var(--marp-slide-max-width, 100%));
          max-width: 100%;
          height: auto;
          background: #ffffff;
          box-shadow: 0 1px 4px rgba(31, 35, 40, 0.18);
        }

        img {
          cursor: zoom-in;
        }
      </style>
      ${rendered.html}
    `
    onReady()
  }, [onReady, rendered])

  return <div ref={hostRef} className="marp-preview-shadow" />
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

async function renderMarpHtml({
  content,
  markdownAssetDataUrls,
  markdownAssetPaths,
  markdownAssetAbsolutePaths
}: {
  content: string
  markdownAssetDataUrls?: Record<string, string>
  markdownAssetPaths?: Record<string, string>
  markdownAssetAbsolutePaths?: Record<string, string>
}): Promise<{ html: string; css: string }> {
  const rendered = await marpMarkdownToHtml(content, {
    resolveImageSrc: (href) => markdownAssetDataUrls?.[href],
    resolveImagePath: (href) => markdownAssetPaths?.[href],
    resolveImageAbsolutePath: (href) => markdownAssetAbsolutePaths?.[href]
  })

  return {
    html: sanitizeMarpHtml(rendered.html),
    css: rendered.css
  }
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
  onPreviewImageClick: (
    container: ParentNode,
    event: ReactMouseEvent<HTMLElement>,
    targetImage?: HTMLImageElement
  ) => void
  onSelectPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  onOpenMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  onMarkdownAnchorHandled: (token: number) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const markdownBodyRef = useRef<HTMLElement | null>(null)
  const isMarpPreview = isMarpMarkdown(content)
  const [marpSlideMaxWidth, setMarpSlideMaxWidth] = useState<number | undefined>()
  const [marpPreviewState, setMarpPreviewState] = useState<
    | {
        content: string
        markdownAssetDataUrls?: Record<string, string>
        markdownAssetPaths?: Record<string, string>
        markdownAssetAbsolutePaths?: Record<string, string>
        rendered: { html: string; css: string }
      }
    | undefined
  >()
  const markdownPreview = isMarpPreview ? undefined : getMarkdownPreview(content)
  const marpPreview =
    isMarpPreview &&
    marpPreviewState?.content === content &&
    marpPreviewState.markdownAssetDataUrls === markdownAssetDataUrls &&
    marpPreviewState.markdownAssetPaths === markdownAssetPaths &&
    marpPreviewState.markdownAssetAbsolutePaths === markdownAssetAbsolutePaths
      ? marpPreviewState.rendered
      : undefined

  const setMarkdownPreviewRoot = (element: HTMLElement | null): void => {
    markdownBodyRef.current = element
    rootRef(element)

    if (element && !isMarpPreview) {
      void renderMermaidDiagrams(element)
    }
  }

  useEffect(() => {
    const container = markdownBodyRef.current
    if (!isMarpPreview || !container) {
      setMarpSlideMaxWidth(undefined)
      return
    }

    const updateMarpSlideMaxWidth = (): void => {
      setMarpSlideMaxWidth(getMarpSlideMaxWidth(container, marpPreview?.html))
    }

    updateMarpSlideMaxWidth()

    const resizeObserver = new ResizeObserver(updateMarpSlideMaxWidth)
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [isMarpPreview, marpPreview])

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
    const copyButton = findEventPathElement<HTMLButtonElement>(event, 'button[data-copy-code]')
    if (copyButton) {
      if (!isPrimaryClick(event)) return
      event.preventDefault()
      void handleMarkdownCodeCopy(copyButton)
      return
    }

    const link = findEventPathElement<HTMLAnchorElement>(event, 'a[data-markdown-link]')
    if (!link) return
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
    const image = findEventPathElement<HTMLImageElement>(event, 'img')
    onPreviewImageClick(
      image ? getPreviewImageContainer(image, event.currentTarget) : event.currentTarget,
      event,
      image
    )
    if (event.defaultPrevented) return

    handleMarkdownLinkClick(event)
  }

  const handleMarkdownLinkContextMenu = (event: ReactMouseEvent<HTMLElement>): void => {
    if (findEventPathElement<HTMLImageElement>(event, 'img')) return

    const link = findEventPathElement<HTMLAnchorElement>(event, 'a[data-markdown-link]')
    if (!link) return

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

    if (isMarpPreview) {
      return
    }

    localizeMarkdownCodeCopyButtons(container)

    let isCancelled = false
    void renderMermaidDiagrams(container).then(() => {
      if (!isCancelled) onContentReady()
    })

    return () => {
      isCancelled = true
    }
  }, [content, isMarpPreview, localizeMarkdownCodeCopyButtons, onContentReady])

  useEffect(() => {
    if (!isMarpPreview) return

    let isCancelled = false

    void renderMarpHtml({
      content,
      markdownAssetDataUrls,
      markdownAssetPaths,
      markdownAssetAbsolutePaths
    }).then((rendered) => {
      if (!isCancelled) {
        setMarpPreviewState({
          content,
          markdownAssetDataUrls,
          markdownAssetPaths,
          markdownAssetAbsolutePaths,
          rendered
        })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [
    content,
    isMarpPreview,
    markdownAssetAbsolutePaths,
    markdownAssetDataUrls,
    markdownAssetPaths
  ])

  return (
    <article
      ref={setMarkdownPreviewRoot}
      className={isMarpPreview ? 'marp-preview' : 'markdown-body'}
      style={
        isMarpPreview && marpSlideMaxWidth !== undefined
          ? ({ '--marp-slide-max-width': `${marpSlideMaxWidth}px` } as CSSProperties)
          : undefined
      }
      onAuxClick={handleMarkdownLinkClick}
      onClick={handleMarkdownPreviewClick}
      onContextMenu={handleMarkdownLinkContextMenu}
    >
      {marpPreview && <MarpPreviewContent rendered={marpPreview} onReady={onContentReady} />}
      {markdownPreview?.title && (
        <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
      )}
      {markdownPreview && (
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
      )}
    </article>
  )
}
