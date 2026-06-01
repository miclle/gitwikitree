# Git Wikitree Agent Guide

This file is the shared entry point for Codex, Claude Code, and other agentic
tools working in this repository. Keep project-facing documentation in English
unless the user explicitly asks otherwise.

## Project Overview

Git Wikitree is a local Git file workspace desktop app built with Electron 42,
electron-vite, React 19, and TypeScript. The app opens local Git repositories,
displays local workspace file trees, previews directories, Markdown, HTML, SVG,
PDF, images, and text files, and supports explicit branch switching, worktree
opening, file editing, preview/code/split/blame file views, file tabs, recent
repositories/files, settings, localization, status metadata, and session
restoration.

## Directory Layout

```text
src/main/        # Electron main process, windows, menus, IPC, Git, repository services
src/preload/     # contextBridge API exposure and renderer type declarations
src/shared/      # Types shared across main, preload, and renderer
src/renderer/    # React renderer, workspace UI, previews, navigation, hooks
tests/           # Node.js built-in test runner tests
.agents/rules/   # Detailed project rules for agentic tools
```

## Common Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run format
```

The development server listens on `127.0.0.1:43173` with strict port checking.
If the port is occupied, handle the port conflict; do not assume Vite will
automatically move to another port.

## Core Rules

- When changing capabilities that cross the main, preload, and renderer boundary, update the IPC handler, `src/preload/index.ts`, `src/preload/index.d.ts`, and the matching contract in `src/shared/types.ts`.
- Keep boundary checks for repository paths, file paths, branch refs, and worktrees. Relative paths must not escape the selected repository root.
- Save and edit flows must protect local files from stale writes and preserve the selected repository/worktree context.
- File previews, directory index previews, Markdown links, tab history, recent
  files/repositories, and session state are connected. When changing one, check
  restoration, menu-driven opens, and new-window paths.
- Preview, save, search, and blame flows must use the selected local workspace
  path. Do not fall back to Git object reads for primary content.
- User-facing strings live in the renderer i18n dictionaries and translated Electron menu/context-menu helpers. When adding UI copy, update every supported language and related tests.
- New UI should match the existing desktop-tool feel: clear controls, moderate density, accessible icon buttons, and no marketing-page layout.
- Do not overwrite user changes. The workspace may contain in-progress renderer edits, so inspect `git status` before modifying files.
- Before delivery, run verification that matches the change. Code changes usually require at least `npm run typecheck`, `npm run lint`, and `npm test`.

## Rules and Skills

Repository-specific guidance lives in `.agents/rules/`. Add or update a rule
when a project invariant should guide future agents across many tasks.

This repository does not currently maintain repo-local skills. Add a skill only
for a repeatable multi-step workflow that needs executable procedure or reusable
assets; keep ordinary architecture and product constraints as rules.

## Rule Index

@.agents/rules/project-architecture.md

@.agents/rules/development-workflow.md

@.agents/rules/electron-react-rules.md

@.agents/rules/testing-and-verification.md

@.agents/rules/product-principles.md

@.agents/rules/workspace-behavior.md
