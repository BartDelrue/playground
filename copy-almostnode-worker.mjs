// almostnode runs its Node-like runtime in a Web Worker that it loads from a
// hardcoded absolute URL: `new Worker("/assets/runtime-worker-<hash>.js")`.
// That URL only resolves if the file is served from the web root, so we copy
// almostnode's prebuilt worker out of node_modules for Nitro to serve.
//
// almostnode also registers a service worker from a hardcoded absolute URL:
// `navigator.serviceWorker.register('/__sw__.js')`. That likewise only resolves
// from the web root, so we copy almostnode's dist/__sw__.js alongside it —
// keeping both in sync on every almostnode upgrade rather than maintaining
// hand-placed copies. node-mode preview is broken without them.
//
// Destination is public.node/, NOT public/: almostnode is dynamically imported by
// node mode alone (see app/composables/previews/preview.ts), but public/ ships in
// every build, so these ~3.6 MB were dead weight in the browser and vue outputs.
// nuxt.config.ts mounts public.node/ as a Nitro public asset dir for node mode
// only. Copied rather than mounted straight from almostnode's dist/assets/,
// which also holds a 4.1 MB source map we don't want in the output.
//
// The runtime worker ships under a content-hashed name, so this re-runs on every
// install and prunes stale copies left behind by an almostnode upgrade.
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

// almostnode's exports map blocks package.json, so resolve the main entry (which
// lives in dist/) and find the sibling assets/ dir.
const distDir = dirname(require.resolve('almostnode'))
const srcDir = join(distDir, 'assets')
const destDir = join(here, 'public.node', 'assets')

const isWorker = (f) => /^runtime-worker-.*\.js$/.test(f)

if (!existsSync(srcDir)) {
  console.warn('copy-almostnode-worker: assets dir not found:', srcDir)
  process.exit(0)
}

const workers = readdirSync(srcDir).filter(isWorker)
if (workers.length === 0) {
  console.warn('copy-almostnode-worker: no runtime-worker-*.js found in', srcDir)
  process.exit(0)
}

mkdirSync(destDir, { recursive: true })

// Drop old hashes so an almostnode upgrade doesn't leave orphaned workers behind.
for (const f of readdirSync(destDir).filter(isWorker)) {
  if (!workers.includes(f)) {
    rmSync(join(destDir, f))
    console.log('copy-almostnode-worker: removed stale', f)
  }
}

for (const f of workers) {
  copyFileSync(join(srcDir, f), join(destDir, f))
  console.log(`copy-almostnode-worker: copied ${f} -> public.node/assets/`)
}

// Service worker: fixed name (not content-hashed), served at the web root.
const swSrc = join(distDir, '__sw__.js')
if (existsSync(swSrc)) {
  copyFileSync(swSrc, join(here, 'public.node', '__sw__.js'))
  console.log('copy-almostnode-worker: copied __sw__.js -> public.node/')
} else {
  console.warn('copy-almostnode-worker: __sw__.js not found:', swSrc)
}
