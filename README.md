# GitWikiTree

GitWikiTree is a desktop Git file workspace initialized with Electron, electron-vite, React, and TypeScript.

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

## Current Scope

The app is initialized with a Git file management oriented shell: repository list, file tree, diff preview, and action toolbar. The next implementation step is to connect those surfaces to local filesystem and Git IPC APIs.
