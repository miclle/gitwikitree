import { type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { highlightCodeBlock, languageForExtension } from '../code-highlight'

export function CodePreview({
  content,
  extension,
  rootRef
}: {
  content: string
  extension: string
  rootRef: Ref<HTMLDivElement>
}): React.JSX.Element {
  const { t } = useTranslation()
  const lineCount = Math.max(1, content.split('\n').length)
  const language = languageForExtension(extension)

  return (
    <div ref={rootRef} className="code-preview-shell" aria-label={t('preview.sourceCode')}>
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
