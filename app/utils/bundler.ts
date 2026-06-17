const CDN = 'https://esm.sh'

let _ts: Promise<unknown> | null = null
// @ts-expect-error don't touch it
const getTs = () => (_ts ??= import(/* @vite-ignore */ 'https://esm.sh/typescript'))

export async function transpileTs(source: string, tsx = false): Promise<string> {
  const ts = await getTs()
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: tsx ? ts.JsxEmit.Preserve : ts.JsxEmit.None,
    },
  })
  return result.outputText
}

export function dirOf(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
}

export function resolvePath(from: string, to: string): string {
  const base = to.startsWith('/') ? '' : dirOf(from)
  let p = base + to.replace(/^\//, '').replace(/^\.\//, '')
  while (p.includes('/../')) p = p.replace(/[^/]+\/\.\.\//g, '')
  return p
}

export function rewriteImports(code: string, filename: string, urlMap: Map<string, string>): string {
  return code.replace(/(from\s+|import\s+)(['"])([^'"]+)\2/g, (match, kw, q, spec) => {
    if (spec.startsWith('.') || spec.startsWith('/')) {
      const url = urlMap.get(resolvePath(filename, spec))
      return url ? `${kw}${q}${url}${q}` : match
    }
    return `${kw}${q}${CDN}/${spec}${q}`
  })
}

export type FileCompiler = (filename: string, source: string) => Promise<string>

export async function buildModuleUrls(
  files: Record<string, string>,
  mkblob: (code: string) => string,
  compile: FileCompiler,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>()
  const done = new Set<string>()

  async function process(name: string): Promise<void> {
    if (done.has(name)) return
    done.add(name)
    const src = files[name]
    if (src === undefined) return

    let code: string
    if (name.endsWith('.css')) {
      code = `const __s=document.createElement('style');__s.textContent=${JSON.stringify(src)};document.head.appendChild(__s)`
    } else if (name.endsWith('.json')) {
      code = `export default ${src}`
    } else {
      code = await compile(name, src)
    }

    for (const m of code.matchAll(/(from\s+|import\s+)['"]([./][^'"]+)['"]/g)) {
      await process(resolvePath(name, m[2]!))
    }

    urlMap.set(name, mkblob(rewriteImports(code, name, urlMap)))
  }

  for (const name of Object.keys(files).filter(k => !k.endsWith('.html'))) {
    await process(name)
  }

  return urlMap
}

const CONSOLE_SCRIPT = `<script>
;(function(){
  // Errors and DOM nodes JSON.stringify to "{}" (non-enumerable props) —
  // format them explicitly so students actually see what went wrong.
  const _fmt = a => {
    try {
      if (a instanceof Error) return (a.name || 'Error') + ': ' + a.message
      if (a instanceof Node) return a.outerHTML ?? String(a)
      return typeof a === 'object' ? JSON.stringify(a) : String(a)
    } catch { return String(a) }
  }
  const _post = (type, args) => window.top.postMessage({
    source: 'playground-console',
    type,
    message: args.map(_fmt).join(' ')
  }, '*')
  console.log   = (...a) => _post('info',  a)
  console.info  = (...a) => _post('info',  a)
  console.warn  = (...a) => _post('warn',  a)
  console.error = (...a) => _post('error', a)
  window.addEventListener('error', e => {
    // Module files are served as blob: URLs whose names are opaque UUIDs —
    // only the line number is meaningful to show in that case.
    const loc = !e.filename ? ''
      : e.filename.startsWith('blob:') ? ' (line ' + e.lineno + ')'
      : ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')'
    _post('error', [e.message + loc])
  })
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason
    _post('error', ['Unhandled promise rejection: ' + (r instanceof Error ? r.message : String(r))])
  })
})()
</script>`

// window.top reaches the Nuxt app regardless of any intermediate proxy frames

export function buildHtml(
  source: string,
  filename: string,
  files: Record<string, string>,
  urlMap: Map<string, string>,
): string {
  return source
    .replace(/<link\b[^>]*\bhref=['"]([^'"]+\.css)['"][^>]*/g, (m, href) => {
      const css = files[resolvePath(filename, href)]
      return css ? `<style>${css}</style` : m
    })
    .replace(/(<script\b[^>]*\bsrc=['"])([^'"]+)(['"][^>]*>)/g, (m, pre, src, post) => {
      const url = urlMap.get(resolvePath(filename, src))
      return url ? `${pre}${url}${post}` : m
    })
    .replace(/(<script\b[^>]*type=['"]module['"][^>]*>)([\s\S]*?)(<\/script>)/gi, (m, open, body, close) =>
      `${open}${rewriteImports(body, filename, urlMap)}${close}`,
    )
    .replace(/<head[^>]*>/i, match => match + CONSOLE_SCRIPT)
}

export type LogHandler = (text: string, type?: LogType) => void

export function makePreviewBase() {
  const previewUrl = ref('')
  const isBooting = ref(false)
  const bootStatus = ref('')
  const wc = shallowRef(null)
  const logHandlers: LogHandler[] = []
  const onLog = (h: LogHandler) => logHandlers.push(h)
  const pushLog = (t: string, type: LogType = LogType.INFO) => logHandlers.forEach(h => h(t, type))

  const activeBlobs: string[] = []
  const revoke = () => { activeBlobs.forEach(URL.revokeObjectURL); activeBlobs.length = 0 }
  const mkblob = (code: string, type = 'text/javascript') => {
    const url = URL.createObjectURL(new Blob([code], { type }))
    activeBlobs.push(url)
    return url
  }

  return { previewUrl, isBooting, bootStatus, wc, onLog, pushLog, revoke, mkblob }
}
