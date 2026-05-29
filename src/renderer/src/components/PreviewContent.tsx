import { useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import DOMPurify from 'dompurify'
import { FileText } from 'lucide-react'
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
import type { MarkdownLinkContext, PreviewPayload } from '../../../shared/types'

function sanitizeMarkdownHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_ATTR: ['data-copy-code', 'data-markdown-link'],
    ALLOW_DATA_ATTR: true
  })
}

function CodePreview({
  content,
  extension
}: {
  content: string
  extension: string
}): React.JSX.Element {
  const lineCount = Math.max(1, content.split('\n').length)
  const language = languageForExtension(extension)

  return (
    <div className="code-preview-shell" aria-label="Source code">
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

export function PreviewContent({
  preview,
  pendingAnchor,
  onSelectPath,
  onOpenMarkdownLinkContextMenu,
  onMarkdownAnchorHandled
}: {
  preview: PreviewPayload
  pendingAnchor?: { path: string; hash: string; token: number }
  onSelectPath: (path: string, openInNewTab?: boolean, hash?: string) => boolean
  onOpenMarkdownLinkContextMenu: (item: MarkdownLinkContext) => Promise<void>
  onMarkdownAnchorHandled: (token: number) => void
}): React.JSX.Element {
  const markdownBodyRef = useRef<HTMLElement | null>(null)
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

  useEffect(() => {
    if (!pendingAnchor || pendingAnchor.path !== preview.path || !markdownBodyRef.current) return

    scrollToMarkdownAnchor(pendingAnchor.hash, markdownBodyRef.current)
    onMarkdownAnchorHandled(pendingAnchor.token)
  }, [onMarkdownAnchorHandled, pendingAnchor, preview.path])

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

  const handleMarkdownLinkContextMenu =
    (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) return

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

  if (preview.kind === 'directory') {
    if (preview.readme) {
      const markdownPreview = getMarkdownPreview(preview.readme.content)

      return (
        <article
          ref={markdownBodyRef}
          className="markdown-body"
          onAuxClick={handleMarkdownLinkClick(preview.readme.path)}
          onClick={handleMarkdownLinkClick(preview.readme.path)}
          onContextMenu={handleMarkdownLinkContextMenu(preview.readme.path)}
        >
          {markdownPreview.title && (
            <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
          )}
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeMarkdownHtml(markdownToHtml(markdownPreview.content))
            }}
          />
        </article>
      )
    }

    return (
      <div className="directory-list">
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

    return (
      <article
        ref={markdownBodyRef}
        className="markdown-body"
        onAuxClick={handleMarkdownLinkClick(preview.path)}
        onClick={handleMarkdownLinkClick(preview.path)}
        onContextMenu={handleMarkdownLinkContextMenu(preview.path)}
      >
        {markdownPreview.title && (
          <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
        )}
        <div
          dangerouslySetInnerHTML={{
            __html: sanitizeMarkdownHtml(markdownToHtml(markdownPreview.content))
          }}
        />
      </article>
    )
  }

  if (preview.previewType === 'html' && preview.content !== undefined) {
    return (
      <iframe className="html-preview" title={preview.path} sandbox="" srcDoc={preview.content} />
    )
  }

  if (preview.previewType === 'svg' && preview.content !== undefined) {
    return (
      <div className="image-preview">
        <img
          alt={preview.name}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.content)}`}
        />
      </div>
    )
  }

  if (preview.previewType === 'image' && preview.dataUrl) {
    return (
      <div className="image-preview">
        <img alt={preview.name} src={preview.dataUrl} />
      </div>
    )
  }

  if (preview.content !== undefined) {
    return <CodePreview content={preview.content} extension={preview.extension} />
  }

  return (
    <div className="unsupported-preview">
      <FileText size={32} />
      <strong>Preview unavailable</strong>
      <span>This file type is not rendered yet.</span>
    </div>
  )
}
