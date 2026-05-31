import type React from 'react'
import { FileText, Folder, GitBranch, GitFork } from 'lucide-react'
import {
  getStatusBarEditorFacts,
  getStatusBarFileFacts,
  getLocalizedStatusBarWorkspaceLabel,
  getStatusBarPath
} from '../status-bar'
import type { AppLanguage, PreviewPayload, RepositoryPayload } from '../../../shared/types'
import type { EditorStatusBarState } from '../status-bar'
import { useTranslation } from 'react-i18next'

export function StatusBar({
  repository,
  preview,
  pdfPageCount,
  editorStatus,
  language
}: {
  repository: RepositoryPayload
  preview: PreviewPayload | undefined
  pdfPageCount?: number
  editorStatus?: EditorStatusBarState
  language: AppLanguage
}): React.JSX.Element {
  const { t } = useTranslation()
  const activePath = preview ? getStatusBarPath(repository, preview) : repository.path
  const facts = editorStatus
    ? getStatusBarEditorFacts(editorStatus)
    : preview
      ? getStatusBarFileFacts(preview, { pdfPageCount })
      : []
  const localizedFacts =
    language === 'en'
      ? facts
      : editorStatus
        ? getStatusBarEditorFacts(editorStatus, language)
        : preview
          ? getStatusBarFileFacts(preview, { pdfPageCount, language })
          : []

  return (
    <footer className="status-bar" aria-label={t('status.workspace')}>
      <div className="status-bar-group status-bar-primary">
        <span className="status-bar-item" title={repository.activeRef}>
          <GitBranch size={14} aria-hidden="true" />
          <span>{repository.activeRef}</span>
        </span>
        <span className="status-bar-item" title={repository.rootPath}>
          <GitFork size={14} aria-hidden="true" />
          <span>{getLocalizedStatusBarWorkspaceLabel(repository, language)}</span>
        </span>
        <span className="status-bar-path" title={activePath}>
          {activePath}
        </span>
      </div>
      <div className="status-bar-group status-bar-facts">
        {preview && (
          <span className="status-bar-item" title={preview.path || repository.name}>
            {preview.kind === 'directory' ? (
              <Folder size={14} aria-hidden="true" />
            ) : (
              <FileText size={14} aria-hidden="true" />
            )}
            <span>
              {preview.kind === 'directory' ? t('status.directory') : preview.previewType}
            </span>
          </span>
        )}
        {localizedFacts.map((fact) => (
          <span className="status-bar-fact" key={fact} title={fact}>
            {fact}
          </span>
        ))}
      </div>
    </footer>
  )
}
