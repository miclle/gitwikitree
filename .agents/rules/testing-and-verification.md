# Testing and Verification

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

- Documentation or rules-only changes usually do not need a full build, but verify file presence, symlink correctness, and diff scope.
- TypeScript or IPC contract changes should run at least `npm run typecheck`.
- Pure logic, path handling, session, menu, or preview behavior changes should run `npm test`; when useful, run a focused `node --test tests/<name>.test.mjs`.
- UI/CSS changes should run at least `npm run lint`; high-risk layout changes should start `npm run dev` and check the main flow.
- Settings or localization changes should include the matching settings, i18n, menu, and context-menu tests where relevant.
- Editing or save-flow changes should check stale-write protection, dirty indicators, editable directory index previews, status-bar metadata, and menu-driven save behavior.

## Test Patterns

- Tests use the Node.js built-in test runner and live in `tests/*.test.mjs`.
- TypeScript sources are transpiled into temporary ESM modules through `tests/helpers/transpile-modules.mjs`. When adding tests, list the tested module and its dependency modules.
- Tests involving Git repository behavior usually create a temporary directory, run `git init`, write files, commit, and then validate tree or preview results.
- Every test must clean up temporary repositories and transpiled directories to avoid polluting later tests.

## Verification Reports

When delivering work, report the commands that actually ran. If the change is documentation-only and a full test run was skipped, explicitly state the lightweight verification performed, for example:

```bash
test -L CLAUDE.md
readlink CLAUDE.md
git diff -- AGENTS.md .agents CLAUDE.md
```
