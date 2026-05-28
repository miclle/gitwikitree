# Git Wikitree

Git Wikitree is a desktop Git file workspace initialized with Electron, electron-vite, React, and TypeScript.

## Stack

- Electron for the desktop shell
- electron-vite for fast main, preload, and renderer builds
- React 19 with TypeScript for the renderer UI
- electron-builder for packaging

## Scripts

```bash
npm install
npm run dev
npm run build
```

The development renderer server listens on `127.0.0.1:43173` with strict port
checking enabled. If that port is already in use, `npm run dev` fails instead of
silently moving to another port, which keeps this Electron app from loading or
serving another local app by mistake.

## Current Scope

The app currently opens local Git repositories, builds a tracked/untracked file
tree, previews directories and common file types, supports branch/ref browsing,
persists session state, restores recent repositories/files, and manages file
tabs with per-tab history. IPC payload types are shared across the main,
preload, and renderer layers to keep the Electron contract explicit.
