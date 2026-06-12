# TODO

This file tracks the current product state and near-term direction. Keep the
README product-facing and update this file when shipped behavior, known
limitations, or roadmap priorities change.

## Current Implementation

### Local Workspace Model

- The active workspace is a concrete local path: either the primary Git working
  tree or a linked worktree.
- Repository trees, previews, search, save, rename, delete, recent files, and
  session state preserve `repoPath`, `rootPath`, `activeRef`, and `source`.
- File discovery reads the filesystem and excludes `.git`, `.worktrees`, and
  `node_modules`.
- Branch actions are explicit. Users can switch the primary workspace to a
  local branch, or create/open a branch or remote ref as a linked worktree under
  `.worktrees`.
- App-managed worktrees can be reused, repaired after repository moves, and
  rebuilt when worktree metadata is missing.

### Preview and Reading

- Directory previews use configured home-file candidates by default:
  `README.md`, `README.markdown`, `index.md`, and `_index.md`.
- Directories without a home file render compact directory listings.
- File previews support Markdown, Marp Markdown, HTML, SVG, PDF, images, and
  text-like files.
- Markdown previews support GitHub-flavored Markdown, syntax highlighting,
  heading anchors, copy-code buttons, Mermaid diagrams, local image assets,
  repository links, and link context menus.
- Image previews support an in-app lightbox with keyboard navigation and zoom.
- PDF previews render through `pdfjs-dist` and report page metadata to the
  status bar.

### Editing and File Actions

- Existing text-like files can be edited with CodeMirror.
- Editable directory home files use the same edit and save path as direct file
  previews.
- File views support preview, code, split, and blame modes. Unsupported modes
  degrade to the closest valid mode for the active target.
- Split view is available for editable Markdown-like content and includes a
  keyboard-accessible resizer.
- Save flows call `repository:save-file` with the selected workspace context and
  an expected modified timestamp. Stale writes are rejected by the main process.
- Unsaved editor state is marked in tabs, breadcrumbs, and file tree rows. Git
  modified status is shown separately when no unsaved draft is present.
- File tree context menus support opening in a new tab, opening in a new window,
  copying absolute and relative paths, inline rename, and delete confirmation.
- Rename and delete actions are implemented through main/preload/renderer IPC
  contracts and revalidate repository-relative paths in the main process.

### Search, Blame, and Metadata

- Global repository search opens from the sidebar or `Command/Ctrl+Shift+F`.
- Search matches paths first, then text content in previewable text-like files.
- Search is debounced in the renderer, queues the latest query while a request is
  in flight, caps results at 100, skips files larger than 1 MB, and keeps a
  bounded in-memory content cache.
- Current-tab find works inside the active preview/editor surface.
- Blame view loads on demand through `repository:blame` and `git blame
--line-porcelain`, resolved against the active workspace path.
- Blame rows show line authorship, dates, subjects, short hashes, age grouping,
  contributors, and privacy-preserving GitHub noreply avatar fallbacks.
- The status bar shows workspace source, active ref, active path, preview facts,
  editor cursor/selection facts, file size, encoding, modified times, PDF page
  counts, and latest Git author metadata.

### Settings, Localization, and Session State

- Settings are stored in `settings.json` under Electron `userData` and exposed
  through `settings:get` and `settings:save`.
- Settings include appearance, app language, directory home-file previews and
  candidates, preview typography, editor typography, and editor indentation.
- English and Simplified Chinese are supported across renderer labels, Electron
  menus, context menus, and status formatting.
- Project sessions preserve active repository context, selected path, active
  tab, open tabs, tab history, expanded paths, sidebar width/open state, and
  window bounds.
- Recent repositories and recent files preserve worktree context.

### Verification Baseline

- The current repository has 40 Node.js test suites covering repository
  services, IPC contracts, preview helpers, editing state, file actions, search,
  settings, menus, localization, session restoration, and renderer workspace
  behavior.
- Code changes usually need `npm run typecheck`, `npm run lint`, and `npm test`.
- Documentation-only changes usually need targeted Prettier, `git diff --check`,
  symlink checks for `CLAUDE.md`, and a manual scope review.

## Known Limitations

- Creating new files, creating new folders, moving files, and duplicating files
  are not implemented yet.
- Rename currently changes only the final path segment; it is not a general move
  command.
- Delete is immediate after confirmation and has no trash/recovery flow.
- Autosave is not implemented. Save conflict handling is limited to rejecting
  stale writes with an error.
- Unsaved drafts are not persisted across app restarts.
- Search excludes, file-size limits, result limits, and cache bounds are not
  configurable.
- Search is process-local and in-memory; there is no persistent index,
  incremental watcher, worker pool, or cancellation signal for main-process
  work.
- Git status decoration currently focuses on modified tracked files. Added,
  deleted, renamed, conflicted, ignored, and untracked states are not represented
  as first-class tree states.
- Blame is read-only. There are no commit-row actions, copy-hash actions,
  external-open actions, or line-range compare flows yet.
- There is no broader commit history, diff, staging, pull, push, or sync view.
- Settings are application-wide only. Individual repositories cannot override
  home files, typography, indentation, search limits, or other preferences.
- Font selection is limited to built-in families rather than arbitrary installed
  fonts.
- Localization is maintained manually in static dictionaries.
- Packaging uses electron-builder with signed/notarized macOS release scripts,
  GitHub Release update metadata, and electron-updater checks in packaged apps.
  Contributor-facing release docs and long-term update-channel policy still need
  to be shaped before a serious public launch.

## Near-Term Roadmap

### Workspace File Operations

- Add explicit new-file and new-folder commands with repository-boundary checks.
- Add move support separately from rename, with visible destination validation.
- Consider a safer delete flow that can move items to trash where the platform
  supports it.
- Add focused tests for action availability, active-tab updates, and recent-file
  cleanup after rename/delete/move operations.

### Editing and Save Recovery

- Add a richer stale-save flow with reload, compare, and overwrite choices.
- Persist recoverable unsaved drafts once conflict handling is clear enough.
- Expand CodeMirror language coverage based on real repository usage.
- Add find-and-replace inside the editor after current-tab find remains stable.

### Search and Large Repositories

- Keep search local-files-first.
- Avoid rebuilding the workspace tree for every search once a reliable
  invalidation model exists.
- Add configurable excludes and file-size limits.
- Move heavier indexing/search work behind a bounded queue or worker path.
- Support cancellation for stale searches and return partial results quickly.
- Improve ranking, fuzzy matching, and multi-line snippets.

### Git Metadata and History

- Expand tree status modeling beyond modified tracked files.
- Add lightweight blame actions, starting with copy hash and optional external
  open when a remote URL can be resolved safely.
- Add diff/history surfaces only when they preserve the active workspace, tab,
  path, ref, source, and worktree context.

### Settings and Localization

- Add reset controls for individual settings sections.
- Add per-repository overrides on top of global defaults.
- Add settings import/export after repository-specific settings exist.
- Add a translation maintenance workflow that catches missing keys before
  runtime.

### Open Source Readiness

- Add contributor-facing setup and contribution guidance once the repository is
  public.
- Add release and packaging notes for each supported platform.
- Review README screenshots or demo assets when the app has a stable public UI.
- Keep `AGENTS.md` and `.agents/rules/` in sync with any contribution workflow
  that affects future agent or human maintainers.
