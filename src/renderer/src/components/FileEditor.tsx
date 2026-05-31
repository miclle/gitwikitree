import CodeMirror from '@uiw/react-codemirror'
import { useCallback, useMemo } from 'react'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, indentUnit, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { EditorState, type Extension } from '@codemirror/state'
import type { AppSettings, GitLastChange } from '../../../shared/types'
import type { EditorStatusBarState } from '../status-bar'

const markdownEditorHighlightStyle = HighlightStyle.define([
  {
    tag: tags.heading1,
    color: '#0969da',
    fontWeight: '700'
  },
  {
    tag: [tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6],
    color: '#0969da',
    fontWeight: '700'
  },
  {
    tag: tags.strong,
    fontWeight: '700'
  },
  {
    tag: tags.emphasis,
    fontStyle: 'italic'
  },
  {
    tag: [tags.link, tags.url],
    color: '#0a4b8f'
  },
  {
    tag: tags.monospace,
    color: '#953800'
  },
  {
    tag: tags.quote,
    color: '#57606a'
  },
  {
    tag: [tags.list, tags.meta],
    color: '#8c959f'
  }
])

function editorExtensions(extension: string): Extension[] {
  const normalized = extension.toLowerCase()
  const extensions: Extension[] = [EditorView.lineWrapping]

  if (['.md', '.markdown', '.mdx'].includes(normalized)) {
    extensions.push(markdown(), syntaxHighlighting(markdownEditorHighlightStyle))
  } else if (['.js', '.jsx', '.mjs', '.cjs'].includes(normalized)) {
    extensions.push(javascript({ jsx: true, typescript: false }))
  } else if (['.ts', '.tsx', '.mts', '.cts'].includes(normalized)) {
    extensions.push(javascript({ jsx: normalized.endsWith('x'), typescript: true }))
  } else if (['.html', '.htm'].includes(normalized)) {
    extensions.push(html())
  } else if (['.css', '.scss', '.sass', '.less'].includes(normalized)) {
    extensions.push(css())
  } else if (['.json', '.jsonc'].includes(normalized)) {
    extensions.push(json())
  }

  return extensions
}

function getEditorStatus({
  state,
  encoding,
  modifiedAt,
  lastChange,
  indentation
}: {
  state: EditorState
  encoding: string
  modifiedAt: string
  lastChange?: GitLastChange
  indentation: ReturnType<typeof detectIndentation>
}): EditorStatusBarState {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const selectedRanges = state.selection.ranges.filter((range) => !range.empty)
  const selectedCharacters = selectedRanges.reduce(
    (total, range) => total + Math.abs(range.to - range.from),
    0
  )

  return {
    line: line.number,
    column: head - line.from + 1,
    selectionCount: selectedRanges.length,
    selectedCharacters,
    characterCount: state.doc.length,
    indentStyle: indentation.style,
    indentSize: indentation.size,
    encoding,
    modifiedAt,
    ...(lastChange ? { lastChange } : {})
  }
}

function detectIndentation(
  content: string,
  tabSize: number
): { style: EditorStatusBarState['indentStyle']; size: number } {
  const spaceIndents = new Map<number, number>()
  let tabIndents = 0

  for (const line of content.split('\n')) {
    if (!line.trim()) continue

    const indent = line.match(/^[\t ]+/)?.[0]
    if (!indent) continue

    if (indent.includes('\t')) {
      tabIndents += 1
      continue
    }

    const size = indent.length
    spaceIndents.set(size, (spaceIndents.get(size) ?? 0) + 1)
  }

  if (tabIndents > 0 && tabIndents >= getTotalIndentSamples(spaceIndents)) {
    return { style: 'tab', size: tabSize }
  }

  return { style: 'space', size: getMostLikelySpaceIndent(spaceIndents) }
}

function getTotalIndentSamples(samples: Map<number, number>): number {
  return Array.from(samples.values()).reduce((total, count) => total + count, 0)
}

function getMostLikelySpaceIndent(samples: Map<number, number>): number {
  let bestSize = 2
  let bestCount = 0

  for (const [size, count] of samples) {
    if (count > bestCount || (count === bestCount && size < bestSize)) {
      bestSize = size
      bestCount = count
    }
  }

  return bestSize
}

export function FileEditor({
  content,
  encoding = 'UTF-8',
  extension,
  modifiedAt,
  lastChange,
  settings,
  onChange,
  onStatusChange
}: {
  content: string
  encoding?: string
  extension: string
  modifiedAt: string
  lastChange?: GitLastChange
  settings: AppSettings
  onChange: (content: string) => void
  onStatusChange: (status: EditorStatusBarState) => void
}): React.JSX.Element {
  const contentIndentation = useMemo(
    () => detectIndentation(content, settings.editorIndentSize),
    [content, settings.editorIndentSize]
  )
  const extensions = useMemo(
    () => [
      ...editorExtensions(extension),
      EditorState.tabSize.of(settings.editorIndentSize),
      indentUnit.of(
        settings.editorIndentStyle === 'tab' ? '\t' : ' '.repeat(settings.editorIndentSize)
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          const indentation = update.docChanged
            ? detectIndentation(update.state.doc.toString(), update.state.tabSize)
            : contentIndentation

          onStatusChange(
            getEditorStatus({ state: update.state, encoding, modifiedAt, lastChange, indentation })
          )
        }
      })
    ],
    [
      contentIndentation,
      encoding,
      extension,
      lastChange,
      modifiedAt,
      onStatusChange,
      settings.editorIndentSize,
      settings.editorIndentStyle
    ]
  )
  const handleCreateEditor = useCallback(
    (view: EditorView): void => {
      onStatusChange(
        getEditorStatus({
          state: view.state,
          encoding,
          modifiedAt,
          lastChange,
          indentation: detectIndentation(view.state.doc.toString(), settings.editorIndentSize)
        })
      )
    },
    [encoding, lastChange, modifiedAt, onStatusChange, settings.editorIndentSize]
  )

  return (
    <CodeMirror
      className="file-editor"
      value={content}
      height="100%"
      basicSetup={{
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: true,
        autocompletion: true
      }}
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={handleCreateEditor}
    />
  )
}
