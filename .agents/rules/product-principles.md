# Product and Interaction Principles

## Product Positioning

Git Wikitree is a desktop workspace for browsing, previewing, and lightly editing local Git repository content. The core experience is quickly opening a repository, understanding its directory structure, switching local branches or opening worktrees, and reading files in tabs.

## Design Principles

- Prioritize frequent workflows: opening repositories, browsing the tree, previewing files, switching branches, and returning to recent files.
- The interface should feel like a productivity tool, not a promotional page: compact, clear, and explicit about state.
- The user's local repository is the primary content; UI should not compete with it.
- The workspace should behave like an editor over local files; Git should appear only for version-control operations.
- Long paths, deep directories, many tabs, and large repositories should remain usable.
- Error messages should guide the next step, such as inaccessible paths, failed Git commands, occupied ports, or unsupported previews.

## Feature Tradeoffs

- Before adding a feature, ask whether it strengthens the existing Git workspace flow and avoid side-branch complexity.
- If a capability can be expressed through the existing repository/session/navigation model, do not add a separate state system.
- Behaviors with side effects, such as writing files, opening external links, switching branches, or creating worktrees, should be explicit user actions.
- When completing unfinished or partial features such as search, file creation, editing, or saving, include empty states, loading states, error states, and tests.
