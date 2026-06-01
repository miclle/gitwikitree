# Workspace Behavior Rules

## Local Workspace Model

- Treat the active workspace as a concrete local path: either the primary
  working tree or a linked worktree under the repository root.
- Preserve `repoPath`, `rootPath`, `activeRef`, and `source` whenever an action
  crosses app boundaries: preload IPC calls, session state, recent files,
  menu-driven opens, Markdown links, search, save, and blame.
- Branch switching and worktree opening are explicit actions. Do not make
  previews, search, blame, or navigation silently change refs.
- `.worktrees` is an app-managed worktree location and should stay out of normal
  file discovery and search results.

## Preview, Editing, and Save

- Directory homepage files (`README.md`, `README.markdown`, `index.md`, and
  `_index.md` by default) are first-class preview targets while homepage file
  previews are enabled. If a directory preview uses one of these files, editing
  and saving should follow the same path as a direct file preview.
- Save calls must pass the selected workspace context and an expected modified
  timestamp. Keep stale-write rejection visible to the renderer instead of
  silently overwriting disk changes.
- Dirty state has three surfaces that should agree: titlebar tabs, breadcrumbs,
  and file tree rows. Git-modified file decoration should not hide an unsaved
  editor draft.
- The status bar should show compact, authoritative facts. Avoid duplicating the
  same concept across preview metadata, filesystem timestamps, Git metadata, and
  editor state.

## Search and Blame

- Repository search is local-files-first. It should not depend on Git object
  snapshots for primary content and must reject escaped roots.
- Search result limits, file-size limits, cache bounds, and excludes are
  deliberate product constraints. Update `TODO.md` if those constraints change
  or become configurable.
- Blame is the one current file view that intentionally reads Git history.
  Still resolve the file through the active workspace path, and keep avatar
  lookup privacy-preserving.

## Session and Recent Items

- Recent files and project sessions must preserve worktree context. Opening a
  recent file from a different repository should reset unrelated tabs; opening
  from the same repository can preserve the current tab set.
- Session persistence should stay minimal and project-scoped. Avoid persisting
  transient renderer state unless it clearly improves restart recovery.
