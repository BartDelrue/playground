import { createContainer } from 'almostnode'
import type { FsProvider } from '~/composables/files'
import { buildModuleUrls, buildHtml, transpileTs } from '~/utils/bundler'

type LogHandler = (text: string, type?: LogType) => void

// Module-level singletons — container survives across hot-reloads.
let container: ReturnType<typeof createContainer> | null = null
let devAbortController: AbortController | null = null
let installedPackageJson: string | null = null

// Injected into every HTML file written to the VFS so browser console.log/warn/error
// reaches the playground's Console pane via postMessage — invisible to the student.
const CONSOLE_SCRIPT_HTML = `<script>
;(function(){
  // Errors and DOM nodes JSON.stringify to "{}" (non-enumerable props) —
  // format them explicitly so students actually see what went wrong.
  var _fmt = function(a) {
    try {
      if (a instanceof Error) return (a.name || 'Error') + ': ' + a.message
      if (a instanceof Node) return a.outerHTML != null ? a.outerHTML : String(a)
      return typeof a === 'object' ? JSON.stringify(a) : String(a)
    } catch(e) { return String(a) }
  }
  var _post = function(type, args) {
    window.top.postMessage({
      source: 'playground-console',
      type: type,
      message: Array.from(args).map(_fmt).join(' ')
    }, '*')
  }
  console.log   = function() { _post('info',  arguments) }
  console.info  = function() { _post('info',  arguments) }
  console.warn  = function() { _post('warn',  arguments) }
  console.error = function() { _post('error', arguments) }

  window.addEventListener('error', function(e) {
    var loc = e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : ''
    _post('error', [e.message + loc])
  })
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason
    _post('error', ['Unhandled promise rejection: ' + (r instanceof Error ? r.message : String(r))])
  })
})()
</script>`

function injectConsoleScript(filePath: string, content: string): string {
  if (!filePath.endsWith('.html')) return content
  return content.replace(/<head[^>]*>/i, m => m + CONSOLE_SCRIPT_HTML)
}

// Build the hidden infrastructure runner, stamping in the entry file path
// derived from the package.json dev script so renaming the entry point works.
function buildRunner(entryFile: string): string {
  // Runner lives at /.playground/runner.mjs, so entry is always one level up.
  const importPath = '../' + entryFile
  return `import http from 'http'
import fs from 'fs'
import path from 'path'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
}

const origCreateServer = http.createServer.bind(http)
http.createServer = function(optsOrHandler, maybeHandler) {
  let handler, hasOptions
  if (typeof optsOrHandler === 'function') {
    handler = optsOrHandler
    hasOptions = false
  } else {
    handler = maybeHandler
    hasOptions = true
  }

  function wrappedHandler(req, res) {
    const urlPath = req.url === '/' ? '/index.html' : (req.url || '/').split('?')[0]
    const full = '/client' + urlPath
    // Try static file first via read; avoids existsSync quirks on nested VFS paths.
    try {
      const data = fs.readFileSync(full)
      const ext = path.extname(full)
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-store' })
      res.end(data)
      return
    } catch { /* not a static client file — fall through to app handler */ }
    if (handler) {
      handler(req, res, (err) => {
        if (err) { res.writeHead(500); res.end(String(err)); return }
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not found: ' + full)
      })
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found: ' + full)
    }
  }

  return hasOptions
    ? origCreateServer(optsOrHandler, wrappedHandler)
    : origCreateServer(wrappedHandler)
}

import('${importPath}').catch(err => {
  process.stderr.write('Server startup error: ' + err.message + '\\n')
  process.exit(1)
})
`
}

// Parse the entry file from "node [flags] <file>" in the dev script.
// Falls back to server/index.js if the script is missing or unparseable.
function getEntryFile(packageJson: string): string {
  try {
    const pkg = JSON.parse(packageJson)
    const dev: string = pkg.scripts?.dev ?? ''
    // Drop "node" and any flags (--flag or -f), take the first plain token.
    const file = dev.split(/\s+/).slice(1).find((t: string) => !t.startsWith('-'))
    return file || 'server/index.js'
  } catch {
    return 'server/index.js'
  }
}

export const useAlmostNode = (files: Record<string, string>) => {

  const wc = shallowRef<FsProvider | null>(null)
  const previewUrl = ref('')
  const previewKey = ref(0)
  const isBooting = ref(false)
  const bootStatus = ref('')

  const activeBlobs: string[] = []
  const revoke = () => { activeBlobs.forEach(URL.revokeObjectURL); activeBlobs.length = 0 }
  const mkblob = (code: string, type = 'text/javascript') => {
    const url = URL.createObjectURL(new Blob([code], { type }))
    activeBlobs.push(url)
    return url
  }
  async function compile(filename: string, src: string): Promise<string> {
    if (filename.endsWith('.ts')) return transpileTs(src)
    return src
  }

  const logHandlers: LogHandler[] = []
  const onLog = (handler: LogHandler) => logHandlers.push(handler)
  const pushLog = (text: string, type: LogType = LogType.INFO) => logHandlers.forEach(h => h(text, type))

  // Auto-restart when files change.
  const prevContents = new Map<string, string>()
  let restartTimer: ReturnType<typeof setTimeout> | null = null

  watch(files, () => {
    if (!devAbortController || isBooting.value) return
    let clientChanged = false
    let serverChanged = false
    for (const [path, content] of Object.entries(files)) {
      if (prevContents.get(path) !== content) {
        prevContents.set(path, content)
        if (path.startsWith('client/')) clientChanged = true
        else serverChanged = true
      }
    }
    if (!clientChanged && !serverChanged) return
    if (restartTimer) clearTimeout(restartTimer)
    if (serverChanged) {
      // Server modules are cached in Node — need a full process restart.
      restartTimer = setTimeout(() => { restartTimer = null; restart() }, 750)
    } else {
      // Client files only — re-sync VFS (handles newly added files and path
      // normalization) then remount the iframe.
      restartTimer = setTimeout(async () => {
        restartTimer = null
        if (previewUrl.value && container) {
          await writeFilesToVfs()
          previewKey.value++
        }
      }, 750)
    }
  }, { deep: true })

  function ensureParentDirs(vfs: ReturnType<typeof createContainer>['vfs'], abs: string) {
    const parts = abs.split('/').slice(1, -1)
    let dir = ''
    for (const part of parts) {
      dir += '/' + part
      try { vfs.mkdirSync(dir) } catch { /* already exists */ }
    }
  }

  async function writeFilesToVfs() {
    const vfs = container!.vfs

    // Build blob URLs for all client JS/TS/CSS files so the browser's ES module
    // loader can resolve relative imports without going through the HTTP server
    // (which the almostnode service worker doesn't intercept for module requests).
    const clientFiles: Record<string, string> = {}
    for (const [rel, content] of Object.entries(files)) {
      if (rel.startsWith('client/')) clientFiles[rel.slice('client/'.length)] = content
    }
    revoke()
    const urlMap = Object.keys(clientFiles).length > 0
      ? await buildModuleUrls(clientFiles, mkblob, compile)
      : new Map<string, string>()

    for (const [rel, content] of Object.entries(files)) {
      const abs = '/' + rel
      ensureParentDirs(vfs, abs)
      if (rel.startsWith('client/') && rel.endsWith('.html')) {
        // Replace module src/import references with blob URLs; buildHtml also
        // injects the console capture script so we don't call injectConsoleScript.
        const htmlFilename = rel.slice('client/'.length)
        const processed = buildHtml(content, htmlFilename, clientFiles, urlMap)
        vfs.writeFileSync(abs, processed)
      } else {
        vfs.writeFileSync(abs, injectConsoleScript(abs, content))
      }
    }
  }

  function writePlaygroundFiles() {
    const vfs = container!.vfs
    try { vfs.mkdirSync('/.playground') } catch { /* already exists */ }
    const entryFile = getEntryFile(files['package.json'] ?? '{}')
    vfs.writeFileSync('/.playground/runner.mjs', buildRunner(entryFile))
  }

  function hasDependencies(): boolean {
    try {
      const pkg = JSON.parse(files['package.json'] ?? '{}')
      return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0
    } catch { return false }
  }

  async function maybeInstall(): Promise<void> {
    if (!hasDependencies()) return
    if (files['package.json'] === installedPackageJson) return
    bootStatus.value = 'Installing dependencies…'
    pushLog('Installing dependencies…')
    await container!.npm.installFromPackageJson({
      onProgress: (msg) => pushLog(msg),
    })
    installedPackageJson = files['package.json'] ?? null
    pushLog('Dependencies installed')
  }

  function startServer() {
    devAbortController = new AbortController()

    try {
      const pkg = JSON.parse(files['package.json'] ?? '{}')
      pushLog(pkg.scripts?.dev ? '$ npm run dev' : '$ node server/index.js')
    } catch {
      pushLog('$ node server/index.js')
    }

    container!.run('node .playground/runner.mjs', {
      onStdout: (data) => pushLog(data.trim()),
      onStderr: (data) => { const t = data.trim(); if (t) pushLog(t, LogType.ERROR) },
      signal: devAbortController.signal,
    }).then(result => {
      // If the process exits while we're still waiting for the server to come up
      // (e.g. syntax error prevented listen()), unblock the booting state.
      if (isBooting.value) {
        isBooting.value = false
        bootStatus.value = ''
      }
      if (result.exitCode !== 0 && result.exitCode !== null) {
        if (result.stderr) pushLog(result.stderr.trim(), LogType.ERROR)
        pushLog(`Server exited with code ${result.exitCode}`, LogType.ERROR)
      }
    }).catch(err => {
      if (err?.name !== 'AbortError') {
        pushLog(err instanceof Error ? err.message : String(err), LogType.ERROR)
        isBooting.value = false
        bootStatus.value = ''
      }
    })
  }

  async function boot(): Promise<void> {
    isBooting.value = true
    bootStatus.value = 'Creating runtime…'
    previewUrl.value = ''
    try {
      if (!container) {
        container = createContainer({
          // @ts-expect-error don't touch it
          dangerouslyAllowSameOrigin: true,
          onServerReady: (port, url) => {
            previewUrl.value = url
            pushLog(`Server ready → ${url}`)
            isBooting.value = false
            bootStatus.value = ''
          },
        })

        wc.value = {
          fs: {
            mkdir: async (p, _o) => {
              const abs = p.startsWith('/') ? p : '/' + p
              ensureParentDirs(container!.vfs, abs + '/x')
              try { container!.vfs.mkdirSync(abs) } catch { /* exists */ }
            },
            writeFile: async (p, c) => {
              const abs = p.startsWith('/') ? p : '/' + p
              const content = typeof c === 'string' ? c : new TextDecoder().decode(c)
              container!.vfs.writeFileSync(abs, injectConsoleScript(abs, content))
            },
          },
        }

        bootStatus.value = 'Initialising service worker…'
        await container.serverBridge.initServiceWorker()
        pushLog('Runtime ready')
      }

      bootStatus.value = 'Mounting files…'
      await writeFilesToVfs()
      writePlaygroundFiles()
      pushLog('Files mounted')

      await maybeInstall()

      bootStatus.value = 'Starting server…'
      startServer()
      bootStatus.value = 'Waiting for server…'

    } catch (err) {
      pushLog(err instanceof Error ? err.message : String(err), LogType.ERROR)
      isBooting.value = false
      bootStatus.value = ''
    }
  }

  async function restart(): Promise<void> {
    devAbortController?.abort()
    devAbortController = null
    previewUrl.value = ''
    isBooting.value = true

    if (!container) { await boot(); return }

    try {
      bootStatus.value = 'Mounting files…'
      await writeFilesToVfs()
      writePlaygroundFiles()

      await maybeInstall()

      bootStatus.value = 'Starting server…'
      startServer()
      bootStatus.value = 'Waiting for server…'

    } catch (err) {
      pushLog(err instanceof Error ? err.message : String(err), LogType.ERROR)
      isBooting.value = false
      bootStatus.value = ''
    }
  }

  return { onLog, wc, previewUrl, previewKey, isBooting, bootStatus, boot, restart }
}
