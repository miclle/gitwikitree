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
