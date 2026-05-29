# Electron + React Rules

## IPC and Preload

- The renderer must not import `electron` directly. Use preload-exposed capabilities through `window.api`.
- When adding an `ipcMain.handle` or `webContents.send` channel, use a clear semantic channel name and update preload implementation, type declarations, and relevant tests.
- Event subscription APIs must return an unsubscribe function, and React `useEffect` callers must clean up listeners.
- Main-side handlers should return serializable objects, not class instances, functions, Buffers, or unstable structures.

## React Components

- Prefer function components and hooks for new code, following the existing TypeScript style.
- Put complex state in hooks or pure functions; components should compose UI and events.
- Local JSX handlers are acceptable, but frequently rendered large lists need stable keys and care around unnecessary recomputation.
- Icon buttons must provide accessible names. Form controls should use labels or `aria-label`.

## State and Persistence

- Treat `SessionState` and `ProjectSessionState` as the source of truth for session state. Do not add parallel implicit storage without a clear reason.
- Preserve `rootPath`, `activeRef`, and `source` when saving window state, opening tabs, recording recent files, and handling repository sources.
- Prevent stale async requests from overwriting newer state. Use the existing loading/error patterns where appropriate.

## Styling

- Global app styles mostly live in `src/renderer/src/assets/main.css`; base styles live in `base.css`.
- Avoid large single-color themes, decorative backgrounds, and nested cards. Desktop-tool UI should stay clear, restrained, and easy to scan.
- Long paths, branch names, and file names need truncation, wrapping, or tooltips so they do not crowd window controls or tab actions.
