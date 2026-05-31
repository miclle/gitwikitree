# Project Architecture Reference

## Processes and Contracts

```text
src/main/             src/preload/                 src/renderer/
Electron app          contextBridge                React workspace
windows/menus/session window.api type contract      file tree/previews/tabs
Git/repository svc    event subscriptions/IPC       interactions/state hooks
```

- `src/main/index.ts` owns the app lifecycle, window creation, menus, session reads/writes, and IPC handler registration.
- `src/main/repository-service.ts` composes repository loading, previews, saving, branch checkout, and worktree opening.
- `src/main/repository-loader.ts`, `repository-files.ts`, `repository-tree.ts`, `repository-preview.ts`, `repository-worktree.ts`, `repository-workspace.ts`, and `git-service.ts` handle Git metadata, local file discovery, tree construction, preview generation, branch checkout, worktrees, and lower-level git commands.
- `src/preload/index.ts` exposes `window.api`; when adding capabilities, update `GitWikitreeAPI` in `src/preload/index.d.ts` at the same time.
- `src/shared/types.ts` is the cross-process type boundary. Model IPC payloads, session state, repository payloads, and preview payloads here first.
- `src/renderer/src/hooks/useRepositoryWorkspace.ts` is the renderer workspace state hub. `WorkspaceView.tsx` should mostly compose UI and interactions.

## Session and Navigation

- `SessionState` contains the current project session, per-repository project sessions, recent repositories, and recent files.
- Opening repositories, switching local branches, opening worktrees, opening recent files, and restoring window state can all affect `repoPath`, `rootPath`, `activeRef`, and `source`.
- File tabs store `history` and `historyIndex`; when changing open/close/navigation logic, verify back, forward, and menu-driven close-current-tab-or-window behavior.
- Directory previews prefer README/index-style files. Breadcrumbs and Markdown internal links must preserve the same path/ref/source context.
- Directory index previews can be editable. When changing editing, saving, or preview refresh behavior, check both direct file previews and directory README/index previews.

## File and Preview Safety

- Re-validate every repository-relative path received from the renderer on the main side. Do not trust UI state.
- Preview reads must stay inside the selected repository or worktree root. Reject escape paths such as `../`.
- The primary workspace should be a local working tree or worktree. Git should be used for explicit version-control actions such as branch checkout, worktree creation, sync, and commit flows.
- Preview and search should read local workspace files. Save flows should write only inside the selected workspace and use stale-write protection. Do not reintroduce Git object reads for primary workspace content.
- Open external URLs through `shell.openExternal`; handle Markdown internal links through the app's own context menu and open logic.
