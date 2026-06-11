// Patches two bugs in almostnode 0.2.14:
//
// PATCH 1 — semver: the satisfies() regex requires full x.y.z tokens, so ranges
// like ">= 2.1.2 < 3" (safer-buffer, transitive dep of express) fail with
// "No matching version found". Fix: normalise incomplete tokens before parsing.
//
// PATCH 2 — worker URL: index.mjs/index.cjs reference the bundled runtime worker
// as `new Worker(new URL(/* @vite-ignore */ "/assets/runtime-worker-HASH.js",
// import.meta.url), { type: "module" })`. Vite's vite:worker-import-meta-url
// plugin ignores the @vite-ignore comment during production builds, tries to
// bundle the worker as a Rollup entry chunk, fails to resolve the absolute path,
// and aborts the build.
// Fix: replace the entire `new URL(..., import.meta.url)` expression with a
// plain string URL "/assets/runtime-worker-HASH.js". Without the
// `new URL(..., import.meta.url)` pattern, Vite's plugin never triggers.
// The worker file is also copied to public/assets/ so Nuxt serves it at that URL.
//
// Runs automatically after every install via the postinstall script.
// Self-tests each patch so you'll know when an almostnode update makes it obsolete.

const fs = require('fs')
const path = require('path')

const TESTED_VERSION = '0.2.14'

// --- Patch 1: semver ---

const SEMVER_MARKER = '/* almostnode-semver-patch */'
const SEMVER_NEEDLE = 'range = range.trim();'
const SEMVER_REPLACEMENT =
  SEMVER_MARKER + '\n' +
  "  range = range.trim();\n" +
  "  range = range.replace(/([><]=?|=)\\s*(\\d+\\.\\d+)(?!\\.\\d)/g, function(_, op, v){ return op + ' ' + v + '.0'; });\n" +
  "  range = range.replace(/([><]=?|=)\\s*(\\d+)(?![\\d\\.])/g, function(_, op, v){ return op + ' ' + v + '.0.0'; });"

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`)
  if (start === -1) return null
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++
    else if (source[i] === '}' && --depth === 0) return source.substring(start, i + 1)
  }
  return null
}

function semverBugIsPresent(source) {
  try {
    const fns = ['parseVersion', 'compareVersions', 'satisfies']
      .map(n => extractFunction(source, n))
    if (fns.some(f => !f)) return null
    const satisfies = new Function(`${fns.join('\n')}\nreturn satisfies;`)()
    return satisfies('2.1.2', '>= 2.1.2 < 3') !== true
  } catch {
    return null
  }
}

// --- Patch 2: worker URL ---

const WORKER_MARKER = '/* almostnode-worker-url-patch-v2 */'

// Matches the new URL(..., import.meta.url) wrapper in both the original form
// (with /* @vite-ignore */) and the previously-wrong-patched form (./runtime-worker-).
// Captures the bare filename so we can reconstruct the correct absolute URL.
const WORKER_REGEX = /new URL\(\s*\/\*[^*]*\*\/\s*"(?:[./]*(?:assets\/)?)?(runtime-worker-[A-Za-z0-9]+\.js)",\s*import\.meta\.url\s*\)/g

function workerBugIsPresent(source) {
  return !source.includes(WORKER_MARKER) &&
    /new URL\(\s*\/\*[^*]*\*\/\s*"[^"]*runtime-worker-[A-Za-z0-9]+\.js",\s*import\.meta\.url\s*\)/.test(source)
}

// --- main ---

const pkgPath = path.join(__dirname, 'node_modules/almostnode/package.json')
if (!fs.existsSync(pkgPath)) {
  console.log('patch-almostnode: almostnode not installed, skipping')
  process.exit(0)
}
const installedVersion = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version
if (installedVersion !== TESTED_VERSION) {
  console.warn(`patch-almostnode: NOTE — almostnode is now ${installedVersion}, patch was written for ${TESTED_VERSION}. Self-tests will tell you what is still needed.`)
}

let semverObsolete = 0
let semverPatched = 0
let workerObsolete = 0
let workerPatched = 0

for (const filename of ['index.cjs', 'index.mjs']) {
  const target = path.join(__dirname, 'node_modules/almostnode/dist', filename)
  if (!fs.existsSync(target)) {
    console.log(`patch-almostnode: ${filename} not found, skipping`)
    continue
  }

  let d = fs.readFileSync(target, 'utf8')
  let changed = false

  // --- Patch 1: semver ---
  if (d.includes(SEMVER_MARKER)) {
    console.log(`patch-almostnode: ${filename} — semver already patched`)
  } else {
    const present = semverBugIsPresent(d)
    if (present === false) {
      console.log(`patch-almostnode: ${filename} — semver bug is FIXED upstream, skipping`)
      semverObsolete++
    } else {
      if (present === null) {
        console.warn(`patch-almostnode: ${filename} — could not self-test semver (bundle layout changed?), applying anyway. Verify express still installs in node mode.`)
      }
      const fnStart = d.indexOf('function satisfies(')
      const idx = d.indexOf(SEMVER_NEEDLE, fnStart)
      if (fnStart === -1 || idx === -1) {
        console.warn(`patch-almostnode: ${filename} — semver patch location not found. Upstream may have rewritten satisfies(). Test express install in node mode.`)
      } else {
        d = d.substring(0, idx) + SEMVER_REPLACEMENT + d.substring(idx + SEMVER_NEEDLE.length)
        changed = true
        semverPatched++
        console.log(`patch-almostnode: ${filename} — semver patched`)
      }
    }
  }

  // --- Patch 2: worker URL ---
  if (d.includes(WORKER_MARKER)) {
    console.log(`patch-almostnode: ${filename} — worker URL already patched`)
  } else if (!workerBugIsPresent(d)) {
    console.log(`patch-almostnode: ${filename} — worker URL bug is FIXED upstream, skipping`)
    workerObsolete++
  } else {
    const before = d
    d = d.replace(WORKER_REGEX, (_, fname) => `${WORKER_MARKER} "/assets/${fname}"`)
    if (d === before) {
      console.warn(`patch-almostnode: ${filename} — worker URL regex did not match, skipping. Test node mode build.`)
    } else {
      changed = true
      workerPatched++
      console.log(`patch-almostnode: ${filename} — worker URL patched`)
    }
  }

  if (changed) {
    fs.writeFileSync(target, d)
  }
}

// Copy worker file(s) to public/assets/ so Nuxt serves them at /assets/runtime-worker-HASH.js
const distAssetsDir = path.join(__dirname, 'node_modules/almostnode/dist/assets')
const publicAssetsDir = path.join(__dirname, 'public', 'assets')
if (fs.existsSync(distAssetsDir)) {
  if (!fs.existsSync(publicAssetsDir)) fs.mkdirSync(publicAssetsDir, { recursive: true })
  const workerFiles = fs.readdirSync(distAssetsDir)
    .filter(f => /^runtime-worker-[A-Za-z0-9]+\.js$/.test(f))
  if (workerFiles.length > 0) {
    for (const wf of workerFiles) {
      fs.copyFileSync(path.join(distAssetsDir, wf), path.join(publicAssetsDir, wf))
    }
    console.log(`patch-almostnode: copied ${workerFiles.join(', ')} to public/assets/`)
  }
}

const allSemverFixed = semverObsolete > 0 && semverPatched === 0
const allWorkerFixed = workerObsolete > 0 && workerPatched === 0
if (allSemverFixed && allWorkerFixed) {
  console.log('')
  console.log('='.repeat(72))
  console.log('patch-almostnode: ALL BUGS FIXED UPSTREAM — this patch is obsolete!')
  console.log('You can now: 1) delete patch-almostnode.cjs')
  console.log('             2) remove "&& node patch-almostnode.cjs" from the')
  console.log('                postinstall script in package.json')
  console.log('='.repeat(72))
} else {
  if (allSemverFixed) console.log('patch-almostnode: semver bug fixed upstream — consider removing patch 1')
  if (allWorkerFixed) console.log('patch-almostnode: worker URL bug fixed upstream — consider removing patch 2')
}
