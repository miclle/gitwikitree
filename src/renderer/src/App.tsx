import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Code2,
  File,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  Loader2,
  Plus
} from 'lucide-react'

type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

type Repository = {
  name: string
  path: string
  branch: string
  tree: TreeNode[]
}

type DirectoryPreview = {
  kind: 'directory'
  path: string
  readme?: { path: string; content: string }
  entries?: Array<{ name: string; path: string; type: 'file' | 'directory' }>
}

type FilePreview = {
  kind: 'file'
  path: string
  name: string
  extension: string
  previewType: 'markdown' | 'html' | 'svg' | 'image' | 'text' | 'unsupported'
  content?: string
  dataUrl?: string
  size: number
}

type Preview = DirectoryPreview | FilePreview

const defaultExpanded = new Set([''])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let inList = false

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      continue
    }

    if (inCode) {
      html.push(`${escapeHtml(line)}\n`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const level = heading[1].length
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }

    const listItem = line.match(/^\s*[-*]\s+(.*)$/)
    if (listItem) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInlineMarkdown(listItem[1])}</li>`)
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }

    html.push(line.trim() ? `<p>${renderInlineMarkdown(line)}</p>` : '')
  }

  if (inList) html.push('</ul>')
  if (inCode) html.push('</code></pre>')
  return html.join('\n')
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function iconForNode(node: Pick<TreeNode, 'type' | 'name'>, expanded = false): React.JSX.Element {
  if (node.type === 'directory') {
    return expanded ? <FolderOpen size={18} /> : <Folder size={18} />
  }

  const lowerName = node.name.toLowerCase()
  if (lowerName.endsWith('.md') || lowerName.endsWith('.markdown')) return <BookOpen size={18} />
  if (lowerName.endsWith('.svg') || /\.(png|jpe?g|gif|webp|ico)$/.test(lowerName)) {
    return <FileImage size={18} />
  }
  if (/\.(html?|tsx?|jsx?|css|json|ya?ml|xml|sh|swift|go|rs|py)$/.test(lowerName)) {
    return <FileCode2 size={18} />
  }
  return <File size={18} />
}

function App(): React.JSX.Element {
  const [repository, setRepository] = useState<Repository | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded)
  const [preview, setPreview] = useState<Preview | undefined>()
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [copied, setCopied] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(340)
  const [isResizing, setIsResizing] = useState(false)

  const selectedLabel = selectedPath || repository?.name || 'No repository selected'
  const fullSelectedPath = repository
    ? selectedPath
      ? `${repository.path}/${selectedPath}`
      : repository.path
    : ''

  const loadPreview = useCallback(
    async (path: string, repo = repository): Promise<void> => {
      if (!repo) return

      setPreviewLoading(true)
      setError(undefined)

      try {
        const nextPreview = await window.api.previewPath(repo.path, path)
        setPreview(nextPreview)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setPreviewLoading(false)
      }
    },
    [repository]
  )

  const openRepository = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(undefined)

    try {
      const nextRepository = await window.api.pickRepository()
      if (!nextRepository) return

      setRepository(nextRepository)
      setSelectedPath('')
      setExpandedPaths(defaultExpanded)
      await loadPreview('', nextRepository)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setLoading(false)
    }
  }, [loadPreview])

  const loadRepositoryPath = useCallback(
    async (repoPath: string): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.loadRepository(repoPath)
        setRepository(nextRepository)
        setSelectedPath('')
        setExpandedPaths(defaultExpanded)
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview]
  )

  useEffect(() => {
    const removeOpenPathListener = window.api.onOpenRepositoryPath((repoPath) => {
      void loadRepositoryPath(repoPath)
    })
    const removeOpenRequestListener = window.api.onOpenRepositoryRequest(() => {
      void openRepository()
    })

    return () => {
      removeOpenPathListener()
      removeOpenRequestListener()
    }
  }, [loadRepositoryPath, openRepository])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent): void => {
      setSidebarWidth(Math.min(Math.max(event.clientX, 240), 560))
    }
    const handleMouseUp = (): void => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleSelect = useCallback(
    async (node: TreeNode): Promise<void> => {
      setSelectedPath(node.path)

      if (node.type === 'directory') {
        setExpandedPaths((current) => {
          const next = new Set(current)
          next.has(node.path) ? next.delete(node.path) : next.add(node.path)
          return next
        })
      }

      await loadPreview(node.path)
    },
    [loadPreview]
  )

  const copyPath = useCallback(async (): Promise<void> => {
    if (!fullSelectedPath) return
    await navigator.clipboard.writeText(fullSelectedPath)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [fullSelectedPath])

  const previewTitle = useMemo(() => {
    if (!preview) return 'Preview'
    if (preview.kind === 'directory' && preview.readme) return preview.readme.path
    if (preview.kind === 'directory') return preview.path || repository?.name || 'Repository'
    return preview.path
  }, [preview, repository])

  return (
    <main className={isResizing ? 'app-shell is-resizing' : 'app-shell'}>
      {error && <div className="error-banner">{error}</div>}

      {!repository ? (
        <section className="welcome-state">
          <Code2 size={42} />
          <h2>Open a repository</h2>
          <button
            className="open-button large"
            type="button"
            disabled={loading}
            onClick={openRepository}
          >
            {loading ? <Loader2 className="spin" size={17} /> : <Plus size={17} />}
            Open Repository
          </button>
        </section>
      ) : (
        <section
          className="repo-layout"
          style={{ gridTemplateColumns: `${sidebarWidth}px 1px minmax(0, 1fr)` }}
        >
          <aside className="tree-panel" aria-label="Files">
            <div className="panel-bar">
              <div className="repo-title">
                <strong>Files</strong>
                <span>{repository.path}</span>
              </div>
            </div>

            <div className="tree">
              <button
                className={selectedPath === '' ? 'tree-row selected' : 'tree-row'}
                type="button"
                onClick={() => {
                  setSelectedPath('')
                  void loadPreview('')
                }}
              >
                <ChevronDown size={16} />
                <FolderOpen size={18} />
                <span>{repository.name}</span>
              </button>
              {repository.tree.map((node) => (
                <TreeRow
                  expandedPaths={expandedPaths}
                  key={node.path}
                  level={1}
                  node={node}
                  selectedPath={selectedPath}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </aside>

          <div
            aria-label="Resize panels"
            className="split-resizer"
            role="separator"
            tabIndex={0}
            onMouseDown={() => setIsResizing(true)}
          />

          <section className="preview-panel">
            <div className="path-toolbar">
              <div className="path-title">
                <span>{selectedLabel}</span>
                {preview?.kind === 'file' && <small>{formatBytes(preview.size)}</small>}
              </div>
              <span className="branch-pill">
                <GitBranch size={15} />
                {repository.branch}
              </span>
              <button type="button" title="Copy path" aria-label="Copy path" onClick={copyPath}>
                {copied ? 'Copied' : <Clipboard size={17} />}
              </button>
            </div>

            <div className="preview-body">
              {previewLoading && (
                <div className="loading-state">
                  <Loader2 className="spin" size={26} />
                </div>
              )}
              {!previewLoading && preview && (
                <>
                  <div className="content-header">
                    <span>{previewTitle}</span>
                  </div>
                  <PreviewContent
                    preview={preview}
                    onSelectPath={(path) => {
                      setSelectedPath(path)
                      void loadPreview(path)
                    }}
                  />
                </>
              )}
            </div>
          </section>
        </section>
      )}
    </main>
  )
}

function TreeRow({
  node,
  level,
  expandedPaths,
  selectedPath,
  onSelect
}: {
  node: TreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  onSelect: (node: TreeNode) => Promise<void>
}): React.JSX.Element {
  const expanded = expandedPaths.has(node.path)
  const hasChildren = node.type === 'directory' && Boolean(node.children?.length)

  return (
    <>
      <button
        className={selectedPath === node.path ? 'tree-row selected' : 'tree-row'}
        style={{ '--level': level } as CSSProperties}
        type="button"
        onClick={() => void onSelect(node)}
      >
        {node.type === 'directory' ? (
          expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )
        ) : (
          <span className="tree-spacer" />
        )}
        {iconForNode(node, expanded)}
        <span>{node.name}</span>
      </button>
      {hasChildren &&
        expanded &&
        node.children?.map((child) => (
          <TreeRow
            expandedPaths={expandedPaths}
            key={child.path}
            level={level + 1}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

function PreviewContent({
  preview,
  onSelectPath
}: {
  preview: Preview
  onSelectPath: (path: string) => void
}): React.JSX.Element {
  if (preview.kind === 'directory') {
    if (preview.readme) {
      return (
        <article
          className="markdown-body"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.readme.content) }}
        />
      )
    }

    return (
      <div className="directory-list">
        {(preview.entries ?? []).map((entry) => (
          <button key={entry.path} type="button" onClick={() => onSelectPath(entry.path)}>
            {iconForNode(entry)}
            <span>{entry.name}</span>
          </button>
        ))}
      </div>
    )
  }

  if (preview.previewType === 'markdown' && preview.content) {
    return (
      <article
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.content) }}
      />
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
    return (
      <pre className="code-preview">
        <code>{preview.content}</code>
      </pre>
    )
  }

  return (
    <div className="unsupported-preview">
      <FileText size={32} />
      <strong>Preview unavailable</strong>
      <span>This file type is not rendered yet.</span>
    </div>
  )
}

export default App
