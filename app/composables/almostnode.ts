import { createContainer } from 'almostnode'
import type { FsProvider } from '~/composables/files'

type LogHandler = (text: string, type?: LogType) => void

// Module-level singletons — container survives across hot-reloads.
let container: ReturnType<typeof createContainer> | null = null
let devAbortController: AbortController | null = null
let installedPackageJson: string | null = null

// Injected into every HTML file written to the VFS so browser console.log/warn/error
// reaches the playground's Console pane via postMessage — invisible to the student.
const CONSOLE_SCRIPT_HTML = `<script>
;(function(){
  var _post = function(type, args) {
    window.top.postMessage({
      source: 'playground-console',
      type: type,
      message: Array.from(args).map(function(a){
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a) } catch(e) { return String(a) }
      }).join(' ')
    }, '*')
  }
  console.log   = function() { _post('info',  arguments) }
  console.info  = function() { _post('info',  arguments) }
  console.warn  = function() { _post('warn',  arguments) }
  console.error = function() { _post('error', arguments) }
  
  window.onerror = function (...arguments) { _post('error', arguments) }
  window.onunhandledrejection = function (...arguments) { _post('error', arguments) }
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

const CLIENT = path.join(process.cwd(), 'client')
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
}

function serveStatic(req, res) {
  const file = req.url === '/' ? '/index.html' : req.url.split('?')[0]
  const full = path.join(CLIENT, file)
  if (!fs.existsSync(full)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }
  const ext = path.extname(full)
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Cache-Control': 'no-store' })
  res.end(fs.readFileSync(full))
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
    if (handler) {
      handler(req, res, (err) => {
        if (err) { res.writeHead(500); res.end(String(err)); return }
        serveStatic(req, res)
      })
    } else {
      serveStatic(req, res)
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
      // Client files only — VFS is already updated via wc.fs.writeFile;
      // just remount the iframe to pick up the new content.
      restartTimer = setTimeout(() => {
        restartTimer = null
        if (previewUrl.value) previewKey.value++
      }, 750)
    }
  }, { deep: true })

  function writeFilesToVfs() {
    const vfs = container!.vfs
    for (const [rel, content] of Object.entries(files)) {
      const abs = '/' + rel
      const dir = abs.substring(0, abs.lastIndexOf('/'))
      if (dir && dir !== '/') {
        try { vfs.mkdirSync(dir, { recursive: true }) } catch { /* already exists */ }
      }
      vfs.writeFileSync(abs, injectConsoleScript(abs, content))
    }
  }

  function writePlaygroundFiles() {
    const vfs = container!.vfs
    try { vfs.mkdirSync('/.playground', { recursive: true }) } catch { /* already exists */ }
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
          // @ts-ignore
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
            mkdir: async (p, o) => { try { container!.vfs.mkdirSync(p, o) } catch { /* exists */ } },
            writeFile: async (p, c) => {
              const content = typeof c === 'string' ? c : new TextDecoder().decode(c)
              container!.vfs.writeFileSync(p, injectConsoleScript(p, content))
            },
          },
        }

        bootStatus.value = 'Initialising service worker…'
        await container.serverBridge.initServiceWorker()
        pushLog('Runtime ready')
      }

      bootStatus.value = 'Mounting files…'
      writeFilesToVfs()
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
      writeFilesToVfs()
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
