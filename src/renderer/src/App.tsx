import {
  ChevronRight,
  CircleDot,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequestArrow,
  History,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Split,
  TerminalSquare
} from 'lucide-react'

function App(): React.JSX.Element {
  const repositories = [
    { name: 'gitwikitree', branch: 'main', status: '3 changes' },
    { name: 'docs-workspace', branch: 'draft/git-flow', status: 'clean' },
    { name: 'release-notes', branch: 'main', status: '1 change' }
  ]

  const files = [
    { path: 'src/main/index.ts', state: 'modified' },
    { path: 'src/renderer/src/App.tsx', state: 'modified' },
    { path: 'README.md', state: 'added' },
    { path: 'electron.vite.config.ts', state: 'clean' }
  ]

  const timeline = [
    'Initialize Electron Vite workspace',
    'Add desktop shell for repository browsing',
    'Prepare Git file tree workspace'
  ]

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FolderGit2 size={28} strokeWidth={2.2} />
          <div>
            <h1>GitWikiTree</h1>
            <span>Git file workspace</span>
          </div>
        </div>

        <button className="primary-action" type="button">
          <Plus size={18} />
          Add Repository
        </button>

        <section className="repo-list" aria-label="Repositories">
          {repositories.map((repo, index) => (
            <button
              className={index === 0 ? 'repo-item active' : 'repo-item'}
              key={repo.name}
              type="button"
            >
              <span className="repo-name">{repo.name}</span>
              <span className="repo-meta">
                <GitBranch size={14} />
                {repo.branch}
              </span>
              <span className={repo.status === 'clean' ? 'repo-status clean' : 'repo-status'}>
                {repo.status}
              </span>
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="search-field">
            <Search size={18} />
            <input aria-label="Search files" placeholder="Search files, commits, branches" />
          </div>

          <div className="toolbar-actions" aria-label="Repository actions">
            <button aria-label="Refresh" title="Refresh" type="button">
              <RefreshCw size={18} />
            </button>
            <button aria-label="Open terminal" title="Open terminal" type="button">
              <TerminalSquare size={18} />
            </button>
            <button aria-label="Settings" title="Settings" type="button">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="file-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Repository</span>
                <h2>gitwikitree</h2>
              </div>
              <span className="branch-pill">
                <GitBranch size={14} />
                main
              </span>
            </div>

            <div className="path-row">
              <ChevronRight size={15} />
              <span>src</span>
              <ChevronRight size={15} />
              <span>renderer</span>
              <ChevronRight size={15} />
              <span>src</span>
            </div>

            <div className="file-list">
              {files.map((file) => (
                <button className="file-row" key={file.path} type="button">
                  <FileCode2 size={18} />
                  <span>{file.path}</span>
                  <strong className={file.state}>{file.state}</strong>
                </button>
              ))}
            </div>
          </section>

          <section className="detail-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Selected file</span>
                <h2>src/renderer/src/App.tsx</h2>
              </div>
              <span className="change-count">42 lines</span>
            </div>

            <div className="diff-preview" aria-label="Diff preview">
              <div className="diff-line removed">- default electron-vite welcome screen</div>
              <div className="diff-line added">+ repository sidebar and file workspace</div>
              <div className="diff-line added">+ focused toolbar for Git operations</div>
              <div className="diff-line neutral"> future: connect real Git status through IPC</div>
            </div>

            <div className="action-row">
              <button type="button">
                <Split size={17} />
                Stage File
              </button>
              <button type="button">
                <GitPullRequestArrow size={17} />
                Create Branch
              </button>
              <button type="button">
                <GitCommitHorizontal size={17} />
                Commit
              </button>
            </div>
          </section>

          <section className="activity-panel">
            <div className="panel-heading compact">
              <History size={19} />
              <h2>Activity</h2>
            </div>
            <ol>
              {timeline.map((item) => (
                <li key={item}>
                  <CircleDot size={14} />
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
