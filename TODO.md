# TODO

## Application Settings

Current implementation:

- The app stores application settings in `settings.json` under Electron
  `userData`.
- Settings are exposed through `settings:get` and `settings:save` IPC channels,
  with preload contracts available to the renderer.
- The app menu exposes `Settings...` with `Command/Ctrl+,`; macOS places it in
  the app menu, and other platforms expose it from the Edit menu.
- The renderer includes a settings dialog that immediately applies appearance,
  app language, homepage file previews and candidates, preview font family/size,
  editor font family/size, and editor indentation style/size as each control
  changes.
- Appearance supports light, dark, and system modes.
- App language supports English and Simplified Chinese across renderer labels,
  Electron menus, context menus, and status-bar formatting.
- Directory homepage previews can be enabled or disabled. Candidates default to
  `README.md`, `README.markdown`, `index.md`, and `_index.md`, and the
  configured order is used when building repository trees and directory previews
  while the feature is enabled.
- Preview typography is applied through CSS variables for Markdown and text-like
  code previews.
- Editor typography and indentation settings are applied to the CodeMirror
  editor without rewriting existing file contents.

Known limitations:

- Settings are application-wide only; individual repositories cannot override
  homepage preview behavior, typography, indentation, or autosave behavior yet.
- Autosave is not implemented. It should account for stale edit protection,
  external file changes, save failures, and Git working tree state before being
  enabled.
- Search excludes and file-size limits are not configurable yet.
- Font selection is limited to built-in families rather than arbitrary installed
  fonts.
- Localization is limited to English and Simplified Chinese, and new UI strings
  must still be added to both dictionaries manually.
- Settings import/export and reset-to-default actions are not implemented yet.
- The settings dialog is a single modal surface; there is no dedicated settings
  window or per-section navigation yet.

Future direction:

- Add per-repository overrides on top of global defaults, starting with homepage
  file candidates and search limits.
- Add autosave only after the editor has clear conflict handling and visible
  save-state feedback.
- Add reset controls for individual settings sections.
- Consider import/export once settings include repository-specific overrides.

## File Editing and Preview Workflow

Current implementation:

- Editable previews are derived from file previews and directory index previews,
  so README/index-style directory pages can be edited through the same editor as
  normal files.
- Text-like preview content can be edited with CodeMirror. Markdown, JavaScript,
  TypeScript, HTML, CSS, and JSON use language-aware editing through CodeMirror
  packages, while plain text remains editable without a language package.
- File views support preview, code, split, and blame modes. The selected view
  mode is sticky for the current workspace session and degrades to the closest
  supported mode when the next file cannot use it. Split mode is available for
  editable Markdown-like content and includes a keyboard-accessible resizer
  between editor and preview panes.
- Markdown editing uses a document-oriented syntax highlight style while the
  live preview renders the current draft.
- Save flows call `repository:save-file` with the current workspace context and
  an expected modified timestamp, then refresh the repository tree and preview.
- The main process rejects stale saves when the file changed on disk after the
  preview was loaded.
- Unsaved editor state is marked in the active tab, breadcrumb, and file tree.
  Git-modified files are marked separately in the tree when there is no unsaved
  editor draft for that path.
- The app menu exposes Save with `Command/Ctrl+S` and routes the command to the
  active editable file.

Known limitations:

- Only existing text-like files and directory index files can be edited; creating
  new files, renaming files, deleting files, and moving files are not implemented.
- Autosave is not implemented and save conflict handling is limited to rejecting
  stale writes with an error.
- Editor state is local to the active workspace session; unsaved drafts are not
  persisted across app restarts.
- CodeMirror language coverage is intentionally small and does not yet include
  every previewable text format.
- Directory listing previews are read-only unless the directory has an editable
  index/homepage file.

Future direction:

- Add explicit file creation, rename, delete, and move commands with repository
  boundary checks and clear Git status feedback.
- Add a richer save-conflict flow with reload, compare, and overwrite choices.
- Persist recoverable unsaved drafts once conflict handling is robust enough.
- Expand editor language support based on real repository usage.
- Add find-and-replace inside the editor after current-tab preview search and
  global repository search remain stable.

## Git Blame and History

Current implementation:

- File views include a read-only blame mode for editable file targets.
- The renderer loads blame data through `window.api.getBlame(...)`, backed by
  the main-process `repository:blame` IPC handler and `git blame
--line-porcelain`.
- Blame loading preserves the selected workspace context through `source` and
  `rootPath`, so linked worktrees are blamed against their own checked-out
  files.
- The blame preview groups adjacent lines from the same commit, displays author,
  date, subject, short hash, age indicators, contributor avatars, and code
  lines.
- GitHub noreply addresses are converted to GitHub avatar URLs when they expose
  a numeric user id and login. Other addresses do not generate Gravatar or
  third-party avatar lookups.
- Blame mode degrades back to preview mode when the active target cannot be
  edited or blamed.

Known limitations:

- Blame is read-only; there are no commands for opening commits, copying commit
  hashes, or comparing a line range yet.
- Blame data is loaded on demand and is not cached across file switches.
- Uncommitted local changes are not represented as a first-class blame segment.
- The app does not yet include a broader history, diff, or timeline view.

Future direction:

- Add lightweight commit actions from blame rows, starting with copy hash and
  open in external Git tooling when a remote URL can be resolved safely.
- Consider a small per-file blame cache if repeated mode switches become slow.
- Add diff/history surfaces only when they strengthen the local workspace flow
  and reuse the same repository/worktree context model.

## Localization and Status Metadata

Current implementation:

- The renderer uses i18next with English and Simplified Chinese dictionaries,
  and tests assert that supported languages expose the same translation keys.
- Electron app menus, tree context menus, Markdown-link context menus, and
  browser context menus are translated from the same language setting.
- The status bar shows active ref, workspace source, active path, preview type,
  directory item counts, text word/line counts, PDF page counts, file size,
  encoding, modified time, and latest Git author metadata when available.
- While editing, the status bar switches to editor facts such as cursor line and
  column, selection counts, character count, indentation style/size, encoding,
  and file change metadata.
- Repository loading annotates modified tracked files in the tree, and preview
  loading attaches filesystem modification timestamps plus latest Git change
  metadata.
- Blame and latest-change metadata are separate features: the status bar shows a
  compact latest-change summary, while blame mode owns line-level authorship.

Known limitations:

- Localization is a static in-repo dictionary; there is no external translation
  extraction, coverage report, or runtime language pack loading.
- Git status decoration currently focuses on modified tracked files. Added,
  deleted, renamed, conflicted, ignored, and untracked states are not represented
  in the tree.
- The status bar is informational only; it does not yet expose commands such as
  opening Git history, viewing diffs, or changing indentation from the status
  indicators.
- Latest-change metadata comes from `git log -1` per preview path and is not
  cached as a repository-wide blame/history index.

Future direction:

- Add a lightweight translation maintenance workflow that catches missing keys
  before runtime.
- Expand Git status modeling beyond modified tracked files.
- Connect status-bar Git metadata to diff/history actions once those workflows
  exist.
- Cache or batch Git metadata reads if status display becomes a bottleneck in
  large repositories.

## Optimize Global Search

Current implementation:

- The renderer opens `GlobalSearchModal` from the sidebar search button or
  `Command/Ctrl+Shift+F`.
- Search input is debounced by 300 ms and the renderer avoids concurrent
  repository search requests by queueing the latest query while one request is
  in flight.
- The renderer calls `window.api.searchRepository(...)`, which invokes the
  main-process `repository:search` IPC handler with the source and root context.
- The main process reloads the selected local workspace with `loadRepository`,
  builds a file tree from the filesystem, and searches that tree directly.
- File discovery excludes `.git`, `.worktrees`, and `node_modules`.
- Search first matches repository-relative paths, then reads searchable local
  files for content matches.
- Content search is limited to previewable text-like files: text, Markdown,
  HTML, and SVG.
- Files larger than 1 MB are skipped, and the result set is capped at 100 items.
- Searchable file content is cached per workspace context and reused when the
  file path, mtime, and size have not changed.
- Search caches are bounded to 8 workspace contexts and 1,000 file entries per
  workspace, with older entries evicted first.
- Results are ranked with path matches first, then content matches by line
  number, with path sorting as a tie breaker.
- Multi-term content snippets are built from the first line matching all search
  terms, and result titles, paths, and snippets highlight each matching term.

Known limitations:

- Each search still reloads the workspace tree before using cached searchable
  file content.
- There is no persistent index, incremental update, worker pool, or cancellation
  signal for in-flight main-process work.
- Content search is sequential and simple substring based, so large repositories
  can become slow even though the implementation no longer depends on Git APIs.
- The current cache is process-local and in-memory; it is discarded on app
  restart and refreshed only when file metadata changes or entries are evicted.

Future direction:

- Keep search based on local workspace files rather than Git object APIs.
- Promote the current per-workspace content cache into a fuller search index
  that can avoid rebuilding the workspace tree for every query.
- Update the index incrementally from file watching or explicit refresh events.
- Move heavy indexing/search work behind a bounded worker queue so the main
  process remains responsive.
- Support cancellation for stale queries and return partial results quickly.
- Improve ranking with better path scoring, content frequency, recency, and
  match position.
- Improve multi-line and fuzzy snippets for queries whose terms appear across
  nearby lines rather than on one line.
- Consider configurable excludes and file-size limits for very large projects.
