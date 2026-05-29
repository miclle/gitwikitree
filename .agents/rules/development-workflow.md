# Development Workflow

## Before Starting

- Run `git status --short --branch` first to identify user changes and avoid accidental overwrites.
- Read the relevant modules and tests before editing. The main, preload, and renderer contracts are tightly coupled, so avoid one-sided changes.
- For documentation and collaboration rules, maintain `AGENTS.md` and `.agents/rules/` first. `CLAUDE.md` is only a compatibility entry point.

## Implementation Order

1. Identify whether the change belongs to main, preload, shared, renderer, tests, or several of them.
2. Update shared types and IPC contracts first, then add the main handler and preload exposure.
3. In the renderer, prefer placing state logic in hooks or standalone pure functions so components remain readable.
4. Add tests for independently verifiable pure logic. For Electron APIs, follow the existing dependency-injection or lightweight mock patterns.
5. Run matching verification and inspect `git diff` to confirm there is no unrelated formatting or user work included.

## Git Conventions

- Do not run destructive commands such as `git reset --hard` or `git checkout --` unless the user explicitly asks.
- Do not commit automatically unless the user asks for a commit.
- If a file already has user changes, read the diff first and edit around the existing work carefully.
- Prefer simplified Angular-style commit messages, such as `docs: add agent guidance` or `fix: preserve tab history`.

## UI Workflow

- This is a desktop app; do not add landing pages or marketing-style hero sections.
- New buttons should prefer lucide or existing Tabler icons and include an `aria-label`.
- Keep layouts stable: file trees, titlebar tabs, preview areas, and sidebar resizing should not jump because of hover states, loading states, or long text.
- After frontend changes, verify key views in the local Electron app/browser when possible. If startup is not possible, explain why.
