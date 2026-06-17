// almostnode runs its Node-like runtime in a Web Worker that it loads from a
// hardcoded absolute URL: `new Worker("/assets/runtime-worker-<hash>.js")`.
// That URL only resolves if the file is served from the web root, so we copy
// almostnode's prebuilt worker into public/assets/ (served as-is in dev and
// bundled into the build output for production).
//
// The worker ships under a content-hashed name, so this re-runs on every install
// and prunes stale copies left behind by an almostnode upgrade.
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const here = dirname(fileURLToPath(import.meta.url))

// almostnode's exports map blocks package.json, so resolve the main entry (which
// lives in dist/) and find the sibling assets/ dir.
const srcDir = join(dirname(require.resolve('almostnode')), 'assets')
const destDir = join(here, 'public', 'assets')

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
  console.log(`copy-almostnode-worker: copied ${f} -> public/assets/`)
}
