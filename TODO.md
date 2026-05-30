# TODO

## Optimize Global Search

Current implementation:

- The renderer opens `GlobalSearchModal` from the sidebar search button or
  `Command/Ctrl+Shift+F`.
- Search input is debounced by 300 ms and the renderer avoids concurrent
  repository search requests by queueing the latest query while one request is
  in flight.
- The renderer calls `window.api.searchRepository(repository.path, query, {
  source, rootPath })`, which invokes the main-process `repository:search` IPC
  handler.
- The main process reloads the selected local workspace with `loadRepository`,
  builds a file tree from the filesystem, and searches that tree directly.
- File discovery excludes `.git`, `.worktrees`, and `node_modules`.
- Search first matches repository-relative paths, then reads searchable local
  files for content matches.
- Content search is limited to previewable text-like files: text, Markdown,
  HTML, and SVG.
- Files larger than 1 MB are skipped, and the result set is capped at 100 items.
- Results are ranked with path matches first, then content matches by line
  number, with path sorting as a tie breaker.

Known limitations:

- Each search reloads the workspace tree and performs fresh filesystem reads.
- There is no persistent index, incremental update, cache, worker pool, or
  cancellation signal for in-flight main-process work.
- Content search is sequential and simple substring based, so large repositories
  can become slow even though the implementation no longer depends on Git APIs.
- Snippets are built from the first line containing the raw query string, which
  is less precise for multi-term searches.

Future direction:

- Keep search based on local workspace files rather than Git object APIs.
- Add a per-workspace search index or cache keyed by file path, mtime, size, and
  source context.
- Update the index incrementally from file watching or explicit refresh events.
- Move heavy indexing/search work behind a bounded worker queue so the main
  process remains responsive.
- Support cancellation for stale queries and return partial results quickly.
- Improve ranking with better path scoring, content frequency, recency, and
  match position.
- Improve multi-term snippets and highlighting so displayed context matches the
  actual terms that produced the result.
- Consider configurable excludes and file-size limits for very large projects.
