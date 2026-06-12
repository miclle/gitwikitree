# Git Wikitree

Git Wikitree is a local-first desktop workspace for Git repositories. It opens
folders you already have on disk, presents them as a navigable file tree, and
gives documentation-heavy projects a focused place to read, preview, edit,
search, switch branches, open worktrees, and inspect line authorship.

The app is built for people who spend a lot of time inside repository content:
maintainers reviewing docs, engineers comparing branches, and writers keeping
Markdown sites or knowledge bases close to the actual files.

## What You Can Do

- Open local Git repositories from the app, the menu bar, recent items, or a
  startup path.
- Browse the selected working tree or linked worktree as local files, with Git
  metadata kept in the background.
- Preview directories through their home files, such as `README.md`, `index.md`,
  or `_index.md`, or fall back to compact directory listings.
- Preview Markdown, Marp slide Markdown, HTML, SVG, PDF, images, and text-like
  source files.
- Render Markdown with GitHub-flavored Markdown, syntax highlighting, heading
  anchors, copy-code buttons, Mermaid diagrams, local image assets, and safe
  repository-link handling.
- Edit text-like files and editable directory home files with CodeMirror.
- Move between preview, code, split, and blame views where the active file
  supports them.
- Search paths and text across the selected local workspace.
- Use current-tab find for the active preview or editor.
- Rename and delete files or folders from the file tree context menu, with
  repository-boundary checks in the main process.
- Open tree items and Markdown links in the current tab, a new tab, or a new
  window.
- Switch the primary workspace to another local branch, or open a branch or
  remote ref as an isolated Git worktree under `.worktrees`.
- Keep multiple tabs with per-tab back and forward history.
- Restore project sessions, expanded paths, active tabs, recent repositories,
  recent files, sidebar state, and window bounds.
- Receive signed packaged-app updates from GitHub Releases when a newer release
  is available.
- Configure light, dark, or system appearance; English or Simplified Chinese;
  directory home-file candidates; preview typography; and editor typography and
  indentation.
- See workspace, branch, path, preview, editor, modified-time, and latest Git
  author facts in the status bar.

## Product Shape

Git Wikitree is not a remote repository browser or a Git history dashboard. Its
center of gravity is the checked-out workspace on your machine. Git operations
are explicit: branch switching changes the active local workspace, and worktree
opening creates or reuses a separate working copy.

This local-files-first model keeps previews, edits, search results, recent
files, and session restoration aligned with what is actually on disk.

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
silently moving to another port.

Build the app, then preview the production output locally:

```bash
npm run build
npm run start
```

## Stack

- Electron 42 for the desktop shell
- electron-vite and Vite for main, preload, and renderer builds
- React 19 and TypeScript for the renderer UI
- CodeMirror for editing
- Node.js built-in test runner for tests
- ESLint and Prettier for code quality and formatting
- electron-builder and electron-updater for packaging and GitHub Release updates

## Project Layout

```text
src/main/        Electron main process, windows, menus, IPC, Git services
src/preload/     contextBridge API exposure and renderer type declarations
src/shared/      Types shared across main, preload, and renderer
src/renderer/    React UI, previews, navigation, hooks, and styles
tests/           Node.js test runner suites and TypeScript transpile helpers
.agents/         Agent collaboration rules for this repository
```

## Scripts

```bash
npm run dev               # Start electron-vite development mode
npm run start             # Preview the built Electron app
npm run build             # Typecheck and build the app
npm run build:unpack      # Build and package an unpacked app directory
npm run build:mac         # Build and package an unsigned macOS app for the current arch
npm run build:mac:intel   # Build and package an unsigned macOS app for Intel Macs
npm run build:mac:arm64   # Build and package an unsigned macOS app for Apple silicon
npm run build:mac:release # Build, sign, notarize, and package for the current macOS arch
npm run build:mac:intel:release # Build, sign, notarize, and package for Intel Macs
npm run build:mac:arm64:release # Build, sign, notarize, and package for Apple silicon
npm run verify:mac:release # Verify the notarized macOS app and DMG contents
npm run verify:mac:intel:release # Verify the notarized Intel macOS app and DMG contents
npm run verify:mac:arm64:release # Verify the notarized Apple silicon app and DMG contents
npm run build:win         # Build and package for Windows x64
npm run build:linux       # Build and package for Linux
npm run build:linux:release # Build Linux AppImage and deb release assets for x64
npm run typecheck         # Run node and web TypeScript checks
npm run typecheck:node    # Typecheck main/preload code
npm run typecheck:web     # Typecheck renderer code
npm run lint              # Run ESLint
npm run test              # Run Node.js test suites
npm run format            # Format the repository with Prettier
```

## Development Notes

Repository-specific implementation guidance lives in `AGENTS.md` and
`.agents/rules/`. Those files are the best starting point before changing IPC,
workspace behavior, preview/edit flows, menus, localization, tests, or
documentation.

## License

This project is licensed under the terms in `LICENSE`.
