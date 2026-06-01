# Git Wikitree

Git Wikitree is a desktop Git file workspace built with Electron 42,
electron-vite, React 19, and TypeScript. It opens local Git repositories,
presents the repository as a navigable file tree, and gives Markdown-heavy
projects a fast preview and editing surface with branch, worktree, tab, blame,
and session-aware navigation.

## Current Status

The app is an active local-first desktop workspace rather than a Git history
browser. Repository trees, previews, search, editing, branch switching, worktree
workflows, and blame views operate against the selected local working tree or
worktree, with explicit Git actions where needed. The current codebase has 38
Node.js test suites covering main-process repository services, IPC contracts,
renderer workspace behavior, preview helpers, settings, session restoration,
menus, and status metadata.

## Features

- Open local Git repositories from the app UI, menu, or startup path.
- Build the repository tree from local workspace files while ignoring Git
  internals, `.worktrees`, and dependency directories.
- Preview directories through README/index files or compact directory listings.
- Preview Markdown, HTML, SVG, PDF, common image formats, and text-like files.
- Search and preview workspace content from local files rather than Git object
  snapshots.
- Render Markdown with GitHub-flavored Markdown, syntax highlighting, heading
  anchors, copy-code buttons, Mermaid diagrams, local image assets, and
  intercepted repository links.
- Open image previews in an in-app lightbox with keyboard navigation and zoom.
- Edit text-like files and directory index files with CodeMirror, stale-write
  protection, preview/code/split/blame modes, session-sticky view mode
  selection, resizable editor panes, and dirty indicators in tabs, breadcrumbs,
  and the file tree.
- Inspect Git blame for editable file targets, including line-level authorship,
  commit subjects, age grouping, and privacy-aware avatar fallbacks.
- Choose a branch action explicitly: switch the current local workspace, or open
  the selected branch as an editable worktree under `.worktrees`.
- Keep multiple file and directory tabs, including per-tab back/forward history.
- Persist project sessions, expanded paths, active tabs, recent repositories,
  recent files, and window bounds.
- Configure appearance, app language, homepage file previews and candidates,
  preview typography, editor typography, and editor indentation.
- Show workspace, branch, path, file facts, editor cursor/selection facts,
  modified timestamps, and latest Git author metadata in the status bar.
- Provide Electron menus and context menus for repository files, Markdown links,
  browser content, recent items, and tab/window closing.
- Localize the renderer UI and menus in English and Simplified Chinese.
- Share IPC payload types across main, preload, and renderer layers to keep the
  desktop contract explicit.

## Stack

- Electron for the desktop shell
- electron-vite and Vite for main, preload, and renderer builds
- React 19 with TypeScript for the renderer UI
- Node.js built-in test runner for tests
- ESLint and Prettier for code quality and formatting
- electron-builder for packaging

## Project Layout

```text
src/main/        Electron main process, windows, menus, IPC, Git services
src/preload/     contextBridge API exposure and renderer type declarations
src/shared/      Types shared across main, preload, and renderer
src/renderer/    React UI, previews, navigation, hooks, and styles
tests/           Node.js test runner suites and TypeScript transpile helpers
.agents/         Agent collaboration rules for this repository
```

## Getting Started

Install dependencies:

```bash
npm install
```

Run the desktop app in development mode:

```bash
npm run dev
```

The development renderer server listens on `127.0.0.1:43173` with strict port
checking enabled. If that port is already in use, `npm run dev` fails instead of
silently moving to another port, which keeps this Electron app from loading or
serving another local app by mistake.

Build the app, then preview the production output locally:

```bash
npm run build
npm run start
```

## Scripts

```bash
npm run dev             # Start electron-vite development mode
npm run start           # Preview the built Electron app
npm run build           # Typecheck and build the app
npm run build:unpack    # Build and package an unpacked app directory
npm run build:mac       # Build and package for macOS
npm run build:win       # Build and package for Windows
npm run build:linux     # Build and package for Linux
npm run typecheck       # Run node and web TypeScript checks
npm run typecheck:node  # Typecheck main/preload code
npm run typecheck:web   # Typecheck renderer code
npm run lint            # Run ESLint
npm run test            # Run Node.js test suites
npm run format          # Format the repository with Prettier
```

## Development Notes

- Renderer code should use `window.api` from preload rather than importing
  Electron directly.
- When adding or changing IPC capabilities, update the main handler, preload
  implementation, preload type declarations, shared payload types, and tests
  together.
- Repository-relative paths must be validated on the main side so preview and
  save operations cannot escape the selected repository root.
- The primary workspace is always a local working tree or worktree; Git actions
  such as branch switching and worktree creation are explicit user choices.
- Preview, save, search, and blame flows operate on the selected local workspace
  path.
- Session state tracks repository context through `repoPath`, `rootPath`,
  `activeRef`, and `source`; preserve those fields when changing navigation or
  recent-item behavior.
- Directory README/index previews are first-class editable targets. Keep their
  edit, save, status, breadcrumb, and tree-refresh behavior aligned with normal
  file previews.
- Agent-oriented project rules live in `AGENTS.md` and `.agents/rules/`.
  `CLAUDE.md` is a compatibility symlink to `AGENTS.md`.

## Verification

For most code changes, run:

```bash
npm run typecheck
npm run lint
npm run test
```

For focused test work, run a single suite with:

```bash
node --test tests/<name>.test.mjs
```

Documentation-only changes can usually be verified with a markdown review and a
targeted `git diff`, but call out any skipped build, lint, or test commands when
delivering the change.

## License

This project is licensed under the terms in `LICENSE`.
