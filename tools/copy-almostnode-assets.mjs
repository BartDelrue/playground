// almostnode runs its Node-like runtime in a Web Worker loaded from a hardcoded absolute
// URL: `new Worker("/assets/runtime-worker-<hash>.js")`. It also registers a service
// worker from `navigator.serviceWorker.register('/__sw__.js')`. Both only resolve from the
// web root, so almostnode's prebuilt copies are lifted out of node_modules into the
// playground's public/ dir.
//
// These used to live in public.node/, mounted for the node build alone, because three
// separate outputs meant ~3.6 MB of dead weight in the browser and vue ones. There is a
// single output now, so public/ is simply correct - and they stay static files fetched on
// demand, so a browser- or vue-mode visitor still downloads none of it. Only deploy size
// grows.
//
// Worth knowing why they cannot move to their own origin: almostnode's cross-origin
// sandbox is createRuntime({ sandbox }), whose generated page speaks only init/syncFile/
// execute/runFile/clearCache. It has no npm install, no ServerBridge and no preview URL,
// all of which node mode needs - so the service worker stays on the play origin until we
// write our own sandbox host. See the architecture notes.
//
// The runtime worker ships under a content-hashed name, so this re-runs on every install
// and prunes stale copies left behind by an almostnode upgrade.
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Resolve from the playground app, not from here: almostnode is that app's dependency,
// and pnpm's isolated node_modules means the workspace root cannot see it.
const require = createRequire(new URL('../apps/playground/package.json', import.meta.url))
const here = dirname(fileURLToPath(import.meta.url))
// This script lives in tools/, so destinations are resolved against the workspace root.
const root = join(here, '..')

// almostnode's exports map blocks package.json, so resolve the main entry (which
// lives in dist/) and find the sibling assets/ dir.
const distDir = dirname(require.resolve('almostnode'))
const srcDir = join(distDir, 'assets')
const destDir = join(root, 'apps', 'playground', 'public', 'assets')

const isWorker = (f) => /^runtime-worker-.*\.js$/.test(f)

if (!existsSync(srcDir)) {
  console.warn('copy-almostnode-assets: assets dir not found:', srcDir)
  process.exit(0)
}

const workers = readdirSync(srcDir).filter(isWorker)
if (workers.length === 0) {
  console.warn('copy-almostnode-assets: no runtime-worker-*.js found in', srcDir)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })

// Drop old hashes so an almostnode upgrade doesn't leave orphaned workers behind.
for (const f of readdirSync(destDir).filter(isWorker)) {
  if (!workers.includes(f)) {
    rmSync(join(destDir, f))
    console.log('copy-almostnode-assets: removed stale', f)
  }
}

for (const f of workers) {
  copyFileSync(join(srcDir, f), join(destDir, f))
  console.log(`copy-almostnode-assets: copied ${f} -> apps/playground/public/assets/`)
}

// Service worker: fixed name (not content-hashed), served at the web root.
const swSrc = join(distDir, '__sw__.js')
if (existsSync(swSrc)) {
  copyFileSync(swSrc, join(root, 'apps', 'playground', 'public', '__sw__.js'))
  console.log('copy-almostnode-assets: copied __sw__.js -> apps/playground/public/')
} else {
  console.warn('copy-almostnode-assets: __sw__.js not found:', swSrc)
}
