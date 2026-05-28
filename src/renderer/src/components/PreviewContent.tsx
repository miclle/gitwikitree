import { type MouseEvent as ReactMouseEvent } from 'react'
import { FileText } from 'lucide-react'
import {
  escapeHtml,
  getMarkdownPreview,
  isExternalLink,
  markdownHeadingId,
  markdownToHtml,
  resolveMarkdownLinkPath
} from '../markdown-preview'
import { iconForNode, shouldOpenInNewTab } from '../app-utils'
import type { PreviewPayload } from '../../../shared/types'

function highlightCodeLine(line: string): string {
  const tokenPattern =
    /('[^']*'|"[^"]*"|`[^`]*`)|\b(import|from|type|const|let|function|return|if|else|for|while|async|await|try|catch|finally|switch|case|break|continue|true|false|undefined|null)\b|\b(\d+(?:\.\d+)?)\b/g
  let cursor = 0
  let html = ''

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0
    html += escapeHtml(line.slice(cursor, index))

    if (match[1]) {
      html += `<span class="tok-string">${escapeHtml(match[1])}</span>`
    } else if (match[2]) {
      html += `<span class="tok-keyword">${escapeHtml(match[2])}</span>`
    } else if (match[3]) {
      html += `<span class="tok-number">${escapeHtml(match[3])}</span>`
    }

    cursor = index + match[0].length
  }

  return html + escapeHtml(line.slice(cursor))
}

function CodePreview({ content }: { content: string }): React.JSX.Element {
  const lines = content.split('\n')

  return (
    <table className="code-table" aria-label="Source code">
      <tbody>
        {lines.map((line, index) => (
          <tr key={`${index}-${line}`}>
            <td className="line-number">{index + 1}</td>
            <td className="line-code">
              <span dangerouslySetInnerHTML={{ __html: highlightCodeLine(line) || ' ' }} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PreviewContent({
  preview,
  onSelectPath
}: {
  preview: PreviewPayload
  onSelectPath: (path: string, openInNewTab?: boolean) => boolean
}): React.JSX.Element {
  const scrollToMarkdownAnchor = (href: string, container: HTMLElement): void => {
    const hash = href.trim().slice(1)
    if (!hash) return

    let anchor = hash
    try {
      anchor = decodeURIComponent(hash)
    } catch {
      anchor = hash
    }

    const escapedAnchor = CSS.escape(anchor)
    const target = container.querySelector<HTMLElement>(
      `[id="${escapedAnchor}"], [name="${escapedAnchor}"]`
    )
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleMarkdownLinkClick = (sourcePath: string) => (event: ReactMouseEvent<HTMLElement>) => {
    if (!(event.target instanceof Element)) return

    const link = event.target.closest<HTMLAnchorElement>('a[data-markdown-link]')
    if (!link || !event.currentTarget.contains(link)) return

    const href = link.getAttribute('href') ?? ''
    event.preventDefault()

    if (href.trim().startsWith('#')) {
      scrollToMarkdownAnchor(href, event.currentTarget)
      return
    }

    if (isExternalLink(href)) {
      window.open(href, '_blank', 'noopener,noreferrer')
      return
    }

    const nextPath = resolveMarkdownLinkPath(href, sourcePath)
    if (nextPath) onSelectPath(nextPath, shouldOpenInNewTab(event))
  }

  if (preview.kind === 'directory') {
    if (preview.readme) {
      const markdownPreview = getMarkdownPreview(preview.readme.content)

      return (
        <article
          className="markdown-body"
          onAuxClick={handleMarkdownLinkClick(preview.readme.path)}
          onClick={handleMarkdownLinkClick(preview.readme.path)}
        >
          {markdownPreview.title && (
            <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
          )}
          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownPreview.content) }} />
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

  if (preview.previewType === 'markdown' && preview.content) {
    const markdownPreview = getMarkdownPreview(preview.content)

    return (
      <article
        className="markdown-body"
        onAuxClick={handleMarkdownLinkClick(preview.path)}
        onClick={handleMarkdownLinkClick(preview.path)}
      >
        {markdownPreview.title && (
          <h1 id={markdownHeadingId(markdownPreview.title)}>{markdownPreview.title}</h1>
        )}
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownPreview.content) }} />
      </article>
    )
  }

  if (preview.previewType === 'html' && preview.content) {
    return (
      <iframe className="html-preview" title={preview.path} sandbox="" srcDoc={preview.content} />
    )
  }

  if (preview.previewType === 'svg' && preview.content) {
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

  if (preview.content) {
    return <CodePreview content={preview.content} />
  }

  return (
    <div className="unsupported-preview">
      <FileText size={32} />
      <strong>Preview unavailable</strong>
      <span>This file type is not rendered yet.</span>
    </div>
  )
}
