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

The app is initialized with a Git file management oriented shell: repository list, file tree, diff preview, and action toolbar. The next implementation step is to connect those surfaces to local filesystem and Git IPC APIs.
