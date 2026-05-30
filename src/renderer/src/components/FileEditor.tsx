import CodeMirror from '@uiw/react-codemirror'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

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

export function FileEditor({
  content,
  extension,
  onChange
}: {
  content: string
  extension: string
  onChange: (content: string) => void
}): React.JSX.Element {
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
      extensions={editorExtensions(extension)}
      onChange={onChange}
    />
  )
}
