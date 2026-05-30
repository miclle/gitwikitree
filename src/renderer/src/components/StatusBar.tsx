import type React from 'react'
import { FileText, Folder, GitBranch, GitFork } from 'lucide-react'
import { getStatusBarFileFacts, getStatusBarPath, getStatusBarWorkspaceLabel } from '../status-bar'
import type { PreviewPayload, RepositoryPayload } from '../../../shared/types'

export function StatusBar({
  repository,
  preview
}: {
  repository: RepositoryPayload
  preview: PreviewPayload | undefined
}): React.JSX.Element {
  const activePath = preview ? getStatusBarPath(repository, preview) : repository.path
  const facts = preview ? getStatusBarFileFacts(preview) : []

  return (
    <footer className="status-bar" aria-label="Workspace status">
      <div className="status-bar-group status-bar-primary">
        <span className="status-bar-item" title={repository.activeRef}>
          <GitBranch size={14} aria-hidden="true" />
          <span>{repository.activeRef}</span>
        </span>
        <span className="status-bar-item" title={repository.rootPath}>
          <GitFork size={14} aria-hidden="true" />
          <span>{getStatusBarWorkspaceLabel(repository)}</span>
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
            <span>{preview.kind === 'directory' ? 'Directory' : preview.previewType}</span>
          </span>
        )}
        {facts.map((fact) => (
          <span className="status-bar-fact" key={fact} title={fact}>
            {fact}
          </span>
        ))}
      </div>
    </footer>
  )
}
