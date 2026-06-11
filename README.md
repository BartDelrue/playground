# JS Playground

A browser-based code playground for teaching JavaScript, Vue and full-stack development. Built with Nuxt 4, Monaco Editor and almostnode.

---

## Three modes

The application is built in three distinct flavours, each targeting a different learning context. The active mode is selected at build time via the `VITE_PREVIEW_MODE` environment variable.

| Mode | Command            | Description                                                                                                       |
|---|--------------------|-------------------------------------------------------------------------------------------------------------------|
| `browser` | `pnpm dev:browser` | Vanilla HTML / CSS / JS. Files are compiled to blob URLs and run directly in an iframe. No server, no npm.        |
| `vue` | `pnpm dev:vue`     | Vue 3 SFC playground powered by [`@vue/repl`](https://github.com/vuejs/repl). Full Volar IntelliSense via Monaco. |
| `node` | `pnpm dev:node`    | Full-stack JS: a Vite frontend + a Node.js backend, using almostnode.                                             |

---

## Getting started

```bash
pnpm install

pnpm dev:node      # full-stack mode
pnpm dev:browser   # browser mode
pnpm dev:vue       # vue mode
```

---

## Building

Each mode produces an independent output under `dist/<mode>/`:

```bash
pnpm build                 # builds all three sequentially
pnpm build:node
pnpm build:browser
pnpm build:vue
```

---

## Project structure

```
app/
  components/        # PlaygroundLayout, VueModeLayout, FileTree, MonacoEditor …
  composables/       # useFiles, usePreview, useConsole, useWebContainer …
  defaults/
    browser/         # starter files for browser mode
    vue/             # starter files for vue mode (App.vue + importmap.json)
    node/            # starter files for full-stack mode (client/ + server/)
  utils/
    bundler.ts       # browser-mode bundler: blob URLs, import rewriting, esm.sh
    logTypes.ts      # LogType enum (auto-imported everywhere)
    fileTree.ts      # buildFileTree utility
public/
  coi-serviceworker.js   # cross-origin isolation fallback (see below)
  favicon-*.svg
```

---

## Console capture

All three modes intercept `console.log / warn / error` in the preview iframe and relay them to the **Console** pane in the playground UI via `window.top.postMessage`.

- **browser / vue**: injected via a `<script>` prepended to `<head>` in the generated HTML (see `utils/bundler.ts`).
- **node**: injected via a hidden Vite plugin written to `.playground/` inside the WebContainer after mount — the user's `vite.config.js` stays clean.

---

## Environment variables

| Variable | Description |
|---|---|
| `VITE_PREVIEW_MODE` | `browser` \| `vue` \| `node` — selects the playground mode |
| `VITE_API_URL` | Optional API base URL for the submission endpoint |

Set per mode via the `.env.*` files:

```
.env              # shared / fallback
.env.browser      # VITE_PREVIEW_MODE=browser
.env.vue          # VITE_PREVIEW_MODE=vue
.env.node         # VITE_PREVIEW_MODE=node
```
