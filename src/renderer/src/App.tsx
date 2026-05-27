import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import { getOpenFileTabsForRecentFile } from '../../main/session-store'
import { getMarkdownPreview } from './markdown-preview'
import {
  BookOpen,
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  File,
  FileArchive,
  FileAudio,
  FileCog,
  FileImage,
  FileLock,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo,
  Folder,
  FolderOpen,
  GitBranch,
  KeyRound,
  Loader2,
  Package,
  Plus,
  Search,
  X
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type TreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: TreeNode[]
}

type Repository = {
  name: string
  path: string
  rootPath: string
  branch: string
  activeRef: string
  source: 'working-tree' | 'git-ref' | 'worktree'
  editable: boolean
  refs: Array<{ name: string; type: 'local' | 'remote'; current: boolean }>
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
  editable: boolean
  content?: string
  dataUrl?: string
  size: number
}

type Preview = DirectoryPreview | FilePreview

type OpenFileTab = {
  path: string
  name: string
}

type SessionState = {
  repositoryPath?: string
  rootPath?: string
  activeRef?: string
  source?: 'working-tree' | 'git-ref' | 'worktree'
  selectedPath: string
  activeFilePath?: string
  openFileTabs: OpenFileTab[]
  expandedPaths: string[]
}

const defaultExpanded = new Set([''])

const fileBadgeByExtension = new Map<string, { label: string; kind: string }>([
  ['ts', { label: 'TS', kind: 'typescript' }],
  ['tsx', { label: 'TS', kind: 'typescript' }],
  ['js', { label: 'JS', kind: 'javascript' }],
  ['jsx', { label: 'JS', kind: 'javascript' }],
  ['mjs', { label: 'JS', kind: 'javascript' }],
  ['cjs', { label: 'JS', kind: 'javascript' }],
  ['css', { label: '#', kind: 'css' }],
  ['scss', { label: '#', kind: 'css' }],
  ['sass', { label: '#', kind: 'css' }],
  ['less', { label: '#', kind: 'css' }],
  ['html', { label: '<>', kind: 'html' }],
  ['htm', { label: '<>', kind: 'html' }],
  ['vue', { label: 'V', kind: 'vue' }],
  ['svelte', { label: 'S', kind: 'svelte' }],
  ['py', { label: 'PY', kind: 'python' }],
  ['go', { label: 'GO', kind: 'go' }],
  ['rs', { label: 'RS', kind: 'rust' }],
  ['swift', { label: 'SW', kind: 'swift' }],
  ['java', { label: 'J', kind: 'java' }],
  ['kt', { label: 'KT', kind: 'kotlin' }],
  ['rb', { label: 'RB', kind: 'ruby' }],
  ['php', { label: 'PHP', kind: 'php' }],
  ['c', { label: 'C', kind: 'c' }],
  ['h', { label: 'H', kind: 'c' }],
  ['cc', { label: 'C++', kind: 'cpp' }],
  ['cpp', { label: 'C++', kind: 'cpp' }],
  ['hpp', { label: 'H++', kind: 'cpp' }],
  ['cs', { label: 'C#', kind: 'csharp' }],
  ['md', { label: 'M', kind: 'markdown' }],
  ['markdown', { label: 'M', kind: 'markdown' }],
  ['mdx', { label: 'M', kind: 'markdown' }],
  ['json', { label: '{}', kind: 'json' }],
  ['jsonc', { label: '{}', kind: 'json' }],
  ['json5', { label: '{}', kind: 'json' }],
  ['yaml', { label: '!', kind: 'yaml' }],
  ['yml', { label: '!', kind: 'yaml' }]
])

function getRepositoryLabel(repository: Repository): string {
  const parts = repository.rootPath.split(/[\\/]/).filter(Boolean)
  const owner = parts.at(-2)
  return owner ? `${owner}/${repository.name}` : repository.name
}

function findTreeNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node

    if (node.children) {
      const match = findTreeNode(node.children, path)
      if (match) return match
    }
  }

  return undefined
}

function fileNameFromPath(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function parentPaths(path: string): string[] {
  const parts = path.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

function fileExtension(name: string): string {
  const normalizedName = name.toLowerCase()
  const parts = normalizedName.split('.')
  return parts.length > 1 ? (parts.at(-1) ?? '') : ''
}

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

function splitTableRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let current = ''
  let escaped = false

  for (const character of trimmed) {
    if (escaped) {
      current += character
      escaped = false
      continue
    }

    if (character === '\\') {
      escaped = true
      continue
    }

    if (character === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  cells.push(current.trim())
  return cells
}

function getTableAlignments(
  row: string
): Array<'left' | 'center' | 'right' | undefined> | undefined {
  const cells = splitTableRow(row)

  if (cells.length === 0 || !cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))) {
    return undefined
  }

  return cells.map((cell) => {
    const compact = cell.replace(/\s+/g, '')
    if (compact.startsWith(':') && compact.endsWith(':')) return 'center'
    if (compact.endsWith(':')) return 'right'
    if (compact.startsWith(':')) return 'left'
    return undefined
  })
}

function isTableStart(currentLine: string, nextLine?: string): boolean {
  return Boolean(
    currentLine.includes('|') && nextLine?.includes('|') && getTableAlignments(nextLine)
  )
}

function renderTableCell(
  tag: 'td' | 'th',
  content: string,
  alignment: 'left' | 'center' | 'right' | undefined
): string {
  const alignAttribute = alignment ? ` style="text-align: ${alignment}"` : ''
  return `<${tag}${alignAttribute}>${renderInlineMarkdown(content)}</${tag}>`
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let inList = false

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

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

    if (isTableStart(line, lines[index + 1])) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }

      const headers = splitTableRow(line)
      const alignments = getTableAlignments(lines[index + 1]) ?? []
      const bodyRows: string[] = []
      index += 2

      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        const cells = splitTableRow(lines[index])
        bodyRows.push(
          `<tr>${headers
            .map((_, cellIndex) =>
              renderTableCell('td', cells[cellIndex] ?? '', alignments[cellIndex])
            )
            .join('')}</tr>`
        )
        index += 1
      }

      index -= 1
      html.push(
        `<table><thead><tr>${headers
          .map((header, cellIndex) => renderTableCell('th', header, alignments[cellIndex]))
          .join('')}</tr></thead><tbody>${bodyRows.join('')}</tbody></table>`
      )
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

function iconForNode(node: Pick<TreeNode, 'type' | 'name'>, expanded = false): React.JSX.Element {
  if (node.type === 'directory') {
    return expanded ? (
      <FolderOpen className="folder-icon" size={18} />
    ) : (
      <Folder className="folder-icon" size={18} />
    )
  }

  const lowerName = node.name.toLowerCase()

  const renderFileIcon = (Icon: LucideIcon, kind: string): React.JSX.Element => (
    <Icon className={`file-icon ${kind}-file-icon`} size={18} />
  )
  const renderFileBadge = (label: string, kind: string): React.JSX.Element => (
    <span aria-hidden="true" className={`file-icon file-badge ${kind}-file-badge`}>
      {label}
    </span>
  )
  const badge = fileBadgeByExtension.get(fileExtension(lowerName))

  if (/^license(\..*)?$/.test(lowerName)) {
    return renderFileIcon(KeyRound, 'license')
  }

  if (/^(changelog|authors|contributors|copying)(\..*)?$/.test(lowerName)) {
    return renderFileIcon(BookOpen, 'document')
  }

  if (/^\.git(ignore|attributes|modules|config)$/.test(lowerName)) {
    return renderFileIcon(GitBranch, 'git')
  }

  if (lowerName === '.editorconfig') {
    return renderFileIcon(FileCog, 'editorconfig')
  }

  if (/^(package(-lock)?|pnpm-lock|yarn|bun)\.(json|yaml|lock|toml)$/.test(lowerName)) {
    return renderFileIcon(Package, 'package')
  }

  if (/(\.lock|lockfile)$/.test(lowerName)) {
    return renderFileIcon(FileLock, 'lock')
  }

  if (badge) {
    return renderFileBadge(badge.label, badge.kind)
  }

  if (/\.(txt|rst|adoc)$/.test(lowerName)) {
    return renderFileIcon(FileText, 'document')
  }

  if (/\.(svg|png|jpe?g|gif|webp|avif|ico|bmp|tiff?)$/.test(lowerName)) {
    return renderFileIcon(FileImage, 'image')
  }

  if (/\.(mp3|wav|flac|aac|m4a|ogg)$/.test(lowerName)) {
    return renderFileIcon(FileAudio, 'media')
  }

  if (/\.(mp4|mov|webm|mkv|avi)$/.test(lowerName)) {
    return renderFileIcon(FileVideo, 'media')
  }

  if (/\.(zip|tar|gz|tgz|bz2|xz|7z|rar)$/.test(lowerName)) {
    return renderFileIcon(FileArchive, 'archive')
  }

  if (/\.(csv|tsv|xlsx?|ods)$/.test(lowerName)) {
    return renderFileIcon(FileSpreadsheet, 'data')
  }

  if (/\.(sqlite|sqlite3|db|sql)$/.test(lowerName)) {
    return renderFileIcon(Database, 'data')
  }

  if (/\.(toml|ini|env|properties|editorconfig)$/.test(lowerName)) {
    return renderFileIcon(FileCog, 'config')
  }

  if (/\.(sh|bash|zsh|fish|ps1|bat|cmd)$/.test(lowerName)) {
    return renderFileIcon(FileTerminal, 'script')
  }

  if (/\.(xml)$/.test(lowerName)) {
    return renderFileIcon(FileType, 'markup')
  }

  if (/\.(graphql|gql)$/.test(lowerName)) {
    return renderFileIcon(Braces, 'code')
  }

  return renderFileIcon(File, 'default')
}

function App(): React.JSX.Element {
  const didRestoreSession = useRef(false)
  const [repository, setRepository] = useState<Repository | undefined>()
  const [selectedPath, setSelectedPath] = useState('')
  const [expandedPaths, setExpandedPaths] = useState(defaultExpanded)
  const [preview, setPreview] = useState<Preview | undefined>()
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [sidebarWidth, setSidebarWidth] = useState(360)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [openFileTabs, setOpenFileTabs] = useState<OpenFileTab[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | undefined>()
  const [isResizing, setIsResizing] = useState(false)

  const fullSelectedPath = repository
    ? repository.source === 'git-ref'
      ? `${repository.path}@${repository.activeRef}${selectedPath ? `:${selectedPath}` : ''}`
      : selectedPath
        ? `${repository.path}/${selectedPath}`
        : repository.path
    : ''

  const loadPreview = useCallback(
    async (path: string, repo = repository): Promise<Preview | undefined> => {
      if (!repo) return undefined

      setPreviewLoading(true)
      setError(undefined)

      try {
        const nextPreview = await window.api.previewPath(repo.path, path, {
          ref: repo.activeRef,
          source: repo.source,
          rootPath: repo.rootPath
        })
        setPreview(nextPreview)
        return nextPreview
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
        return undefined
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
      setOpenFileTabs([])
      setActiveFilePath(undefined)
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
        setOpenFileTabs([])
        setActiveFilePath(undefined)
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview]
  )

  const loadRepositoryWithSession = useCallback(
    async (session: SessionState): Promise<void> => {
      if (!session.repositoryPath) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository =
          session.source === 'git-ref' && session.activeRef
            ? await window.api.loadRef(
                session.rootPath ?? session.repositoryPath,
                session.activeRef,
                session.rootPath
              )
            : await window.api.loadRepository(session.repositoryPath)
        const restoredTabs = session.openFileTabs.filter((tab) => {
          const node = findTreeNode(nextRepository.tree, tab.path)
          return node?.type === 'file'
        })
        const restoredActiveFile =
          session.activeFilePath && restoredTabs.some((tab) => tab.path === session.activeFilePath)
            ? session.activeFilePath
            : restoredTabs[0]?.path
        const selectedPath = restoredActiveFile ?? session.selectedPath ?? ''
        const selectedNode = selectedPath
          ? findTreeNode(nextRepository.tree, selectedPath)
          : undefined
        const nextSelectedPath = selectedNode ? selectedPath : ''

        setRepository(nextRepository)
        setExpandedPaths(new Set(session.expandedPaths.length ? session.expandedPaths : ['']))
        setOpenFileTabs(restoredTabs)
        setActiveFilePath(restoredActiveFile)
        setSelectedPath(nextSelectedPath)
        await loadPreview(nextSelectedPath, nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview]
  )

  const openFilePath = useCallback(
    async (repoPath: string, filePath: string): Promise<void> => {
      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.loadRepository(repoPath)
        const node = findTreeNode(nextRepository.tree, filePath)

        setRepository(nextRepository)
        setExpandedPaths(new Set(['', ...parentPaths(filePath)]))

        if (node?.type === 'file') {
          setSelectedPath(filePath)
          setActiveFilePath(filePath)
          setOpenFileTabs((current) =>
            getOpenFileTabsForRecentFile({
              currentRepositoryPath: repository?.path,
              nextRepositoryPath: nextRepository.path,
              currentTabs: current,
              nextTab: { path: filePath, name: node.name }
            })
          )
          await loadPreview(filePath, nextRepository)
        } else {
          setSelectedPath('')
          setActiveFilePath(undefined)
          await loadPreview('', nextRepository)
          setError(`${fileNameFromPath(filePath)} is no longer available in this repository.`)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview, repository?.path]
  )

  useEffect(() => {
    if (didRestoreSession.current) return
    didRestoreSession.current = true

    void window.api.getSession().then((session) => {
      if (!session.repositoryPath) return
      void loadRepositoryWithSession(session)
    })
  }, [loadRepositoryWithSession])

  useEffect(() => {
    const removeOpenPathListener = window.api.onOpenRepositoryPath((repoPath) => {
      void loadRepositoryPath(repoPath)
    })
    const removeOpenFileListener = window.api.onOpenFilePath(({ repoPath, filePath }) => {
      void openFilePath(repoPath, filePath)
    })
    const removeOpenRequestListener = window.api.onOpenRepositoryRequest(() => {
      void openRepository()
    })

    return () => {
      removeOpenPathListener()
      removeOpenFileListener()
      removeOpenRequestListener()
    }
  }, [loadRepositoryPath, openFilePath, openRepository])

  useEffect(() => {
    if (!repository) return

    const handle = window.setTimeout(() => {
      void window.api.saveSession({
        repositoryPath: repository.path,
        rootPath: repository.rootPath,
        activeRef: repository.activeRef,
        source: repository.source,
        selectedPath,
        activeFilePath,
        openFileTabs,
        expandedPaths: Array.from(expandedPaths)
      })
    }, 250)

    return () => window.clearTimeout(handle)
  }, [activeFilePath, expandedPaths, openFileTabs, repository, selectedPath])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (event: MouseEvent): void => {
      setSidebarWidth(Math.min(Math.max(event.clientX, 280), 520))
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
        setActiveFilePath(undefined)
        if (node.children?.length) {
          setExpandedPaths((current) => {
            if (current.has(node.path)) return current

            const next = new Set(current)
            next.add(node.path)
            return next
          })
        }
      } else {
        setActiveFilePath(node.path)
        setOpenFileTabs((current) =>
          current.some((tab) => tab.path === node.path)
            ? current
            : [...current, { path: node.path, name: node.name }]
        )
      }

      await loadPreview(node.path)
    },
    [loadPreview]
  )

  const toggleDirectory = useCallback((path: string): void => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }, [])

  const selectFileTab = useCallback(
    async (tab: OpenFileTab): Promise<void> => {
      setActiveFilePath(tab.path)
      setSelectedPath(tab.path)
      await loadPreview(tab.path)
    },
    [loadPreview]
  )

  const closeFileTab = useCallback(
    (path: string): void => {
      const tabIndex = openFileTabs.findIndex((tab) => tab.path === path)
      const nextTabs = openFileTabs.filter((tab) => tab.path !== path)

      setOpenFileTabs(nextTabs)

      if (activeFilePath !== path) return

      const nextTab = nextTabs[Math.min(tabIndex, nextTabs.length - 1)]
      if (nextTab) {
        setActiveFilePath(nextTab.path)
        setSelectedPath(nextTab.path)
        void loadPreview(nextTab.path)
      } else {
        setActiveFilePath(undefined)
        setSelectedPath('')
        void loadPreview('')
      }
    },
    [activeFilePath, loadPreview, openFileTabs]
  )

  const copyPath = useCallback(async (): Promise<void> => {
    if (!fullSelectedPath) return
    await navigator.clipboard.writeText(fullSelectedPath)
  }, [fullSelectedPath])

  const switchRef = useCallback(
    async (ref: string): Promise<void> => {
      if (!repository || ref === repository.activeRef) return

      setLoading(true)
      setError(undefined)

      try {
        const nextRepository = await window.api.loadRef(
          repository.rootPath,
          ref,
          repository.rootPath
        )
        setRepository(nextRepository)
        setSelectedPath('')
        setExpandedPaths(defaultExpanded)
        setOpenFileTabs([])
        setActiveFilePath(undefined)
        await loadPreview('', nextRepository)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setLoading(false)
      }
    },
    [loadPreview, repository]
  )

  const breadcrumbParts = selectedPath ? selectedPath.split('/').filter(Boolean) : []
  const repositoryLabel = repository ? getRepositoryLabel(repository) : ''

  return (
    <main className={isResizing ? 'app-shell is-resizing' : 'app-shell'}>
      {repository && (
        <header className="app-titlebar">
          <div className="titlebar-main">
            <div className="titlebar-left">
              <div className="titlebar-window-controls">
                <button
                  className="window-control close"
                  type="button"
                  aria-label="Close window"
                  onClick={() => window.api.controlWindow('close')}
                />
                <button
                  className="window-control minimize"
                  type="button"
                  aria-label="Minimize window"
                  onClick={() => window.api.controlWindow('minimize')}
                />
                <button
                  className="window-control zoom"
                  type="button"
                  aria-label="Toggle fullscreen"
                  onClick={() => window.api.controlWindow('toggle-maximize')}
                />
              </div>
              <div className="titlebar-repository" title={repositoryLabel}>
                {repositoryLabel}
              </div>
              <button
                className="titlebar-icon-button sidebar-toggle-button"
                type="button"
                aria-label={isSidebarOpen ? 'Hide files' : 'Show files'}
                aria-pressed={isSidebarOpen}
                onClick={() => setIsSidebarOpen((current) => !current)}
              >
                {isSidebarOpen ? (
                  <IconLayoutSidebarLeftCollapse size={20} stroke={2} />
                ) : (
                  <IconLayoutSidebarLeftExpand size={20} stroke={2} />
                )}
              </button>
              <button className="titlebar-icon-button" type="button" aria-label="Back" disabled>
                <ChevronLeft size={16} />
              </button>
              <button className="titlebar-icon-button" type="button" aria-label="Forward" disabled>
                <ChevronRight size={16} />
              </button>
            </div>
            <nav className="titlebar-tabs" aria-label="Open tabs">
              {openFileTabs.map((tab) => {
                const active = tab.path === activeFilePath

                return (
                  <div
                    className={active ? 'titlebar-tab active' : 'titlebar-tab'}
                    role="tab"
                    tabIndex={0}
                    aria-selected={active}
                    key={tab.path}
                    title={tab.path}
                    onClick={() => void selectFileTab(tab)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      void selectFileTab(tab)
                    }}
                  >
                    <span className="titlebar-tab-corner" aria-hidden="true" />
                    <FileText size={14} />
                    <span className="titlebar-tab-name">{tab.name}</span>
                    <button
                      className="titlebar-tab-close"
                      type="button"
                      aria-label={`Close ${tab.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        closeFileTab(tab.path)
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )
              })}
            </nav>
          </div>
        </header>
      )}

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
          className={isSidebarOpen ? 'repo-layout' : 'repo-layout sidebar-collapsed'}
          style={{
            gridTemplateColumns: isSidebarOpen
              ? `${sidebarWidth}px 1px minmax(0, 1fr)`
              : 'minmax(0, 1fr)'
          }}
        >
          {isSidebarOpen && (
            <>
              <aside className="tree-panel" aria-label="Files">
                <div className="sidebar-controls">
                  <span className="branch-pill">
                    <GitBranch size={15} />
                    <select
                      aria-label="Branch"
                      disabled={loading}
                      value={repository.activeRef}
                      onChange={(event) => void switchRef(event.target.value)}
                    >
                      {repository.refs.map((ref) => (
                        <option key={`${ref.type}:${ref.name}`} value={ref.name}>
                          {ref.name}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button className="sidebar-control-button" type="button" aria-label="Add">
                    <Plus size={18} />
                  </button>
                  <button
                    className="sidebar-control-button"
                    type="button"
                    aria-label="Search files"
                  >
                    <Search size={18} />
                  </button>
                </div>

                <div className="tree">
                  {repository.tree.map((node) => (
                    <TreeRow
                      expandedPaths={expandedPaths}
                      key={node.path}
                      level={0}
                      node={node}
                      selectedPath={selectedPath}
                      onSelect={handleSelect}
                      onToggle={toggleDirectory}
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
            </>
          )}

          <section className="preview-panel">
            <div className="repo-pathbar">
              <div className="breadcrumb">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPath('')
                    setActiveFilePath(undefined)
                    void loadPreview('')
                  }}
                >
                  {repository.name}
                </button>
                {breadcrumbParts.map((part, index) => {
                  const path = breadcrumbParts.slice(0, index + 1).join('/')
                  const isLast = index === breadcrumbParts.length - 1

                  return (
                    <span className={isLast ? 'breadcrumb-current' : undefined} key={path}>
                      <span className="slash">/</span>
                      {isLast ? (
                        <strong>{part}</strong>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPath(path)
                            setActiveFilePath(undefined)
                            void loadPreview(path)
                          }}
                        >
                          {part}
                        </button>
                      )}
                    </span>
                  )
                })}
                <button
                  className="copy-path-button"
                  type="button"
                  aria-label="Copy path"
                  onClick={copyPath}
                >
                  <Copy size={17} />
                </button>
              </div>
            </div>

            <div className="blob-card">
              <div className="preview-body">
                {previewLoading && (
                  <div className="loading-state">
                    <Loader2 className="spin" size={26} />
                  </div>
                )}
                {!previewLoading && preview && (
                  <PreviewContent
                    preview={preview}
                    onSelectPath={(path) => {
                      const node = findTreeNode(repository.tree, path)
                      if (node) {
                        void handleSelect(node)
                        return
                      }

                      setSelectedPath(path)
                      setActiveFilePath(undefined)
                      void loadPreview(path)
                    }}
                  />
                )}
              </div>
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
  onSelect,
  onToggle
}: {
  node: TreeNode
  level: number
  expandedPaths: Set<string>
  selectedPath: string
  onSelect: (node: TreeNode) => Promise<void>
  onToggle: (path: string) => void
}): React.JSX.Element {
  const expanded = expandedPaths.has(node.path)
  const hasChildren = node.type === 'directory' && Boolean(node.children?.length)
  const selectNode = (): void => {
    void onSelect(node)
  }

  return (
    <>
      <div
        aria-selected={selectedPath === node.path}
        className={selectedPath === node.path ? 'tree-row selected' : 'tree-row'}
        role="treeitem"
        style={{ '--level': level } as CSSProperties}
        tabIndex={0}
        onClick={selectNode}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          selectNode()
        }}
      >
        {node.type === 'directory' ? (
          <button
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
            className="tree-toggle"
            disabled={!hasChildren}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.path)
            }}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <span className="tree-node-button">
          {iconForNode(node, expanded)}
          <span>{node.name}</span>
        </span>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children" style={{ '--level': level } as CSSProperties}>
          {node.children?.map((child) => (
            <TreeRow
              expandedPaths={expandedPaths}
              key={child.path}
              level={level + 1}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </>
  )
}

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

function PreviewContent({
  preview,
  onSelectPath
}: {
  preview: Preview
  onSelectPath: (path: string) => void
}): React.JSX.Element {
  if (preview.kind === 'directory') {
    if (preview.readme) {
      const markdownPreview = getMarkdownPreview(preview.readme.content)

      return (
        <article className="markdown-body">
          {markdownPreview.title && <h1>{markdownPreview.title}</h1>}
          <div dangerouslySetInnerHTML={{ __html: markdownToHtml(markdownPreview.content) }} />
        </article>
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
    const markdownPreview = getMarkdownPreview(preview.content)

    return (
      <article className="markdown-body">
        {markdownPreview.title && <h1>{markdownPreview.title}</h1>}
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

export default App
