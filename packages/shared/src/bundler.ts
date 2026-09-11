/**
 * Browser-side bundler: turns a flat file snapshot into ES-module blob URLs and an HTML
 * document that loads them.
 *
 * This lives in shared because it now runs in two places that must agree exactly:
 *
 *   - apps/preview   the browser-mode shim, where the blob URLs must be created so they
 *                    inherit the PREVIEW origin rather than the app's.
 *   - apps/playground node mode, which bundles the client/ half of a student's project
 *                    before writing it into almostnode's virtual filesystem.
 *
 * Blob URLs inherit the origin of the document that called createObjectURL, which is the
 * whole reason the browser-mode half moved out of the app. Keep it that way.
 */

const CDN = 'https://esm.sh'

// Held in a variable rather than written inline so neither esbuild nor Vite can resolve
// the specifier statically and try to bundle the TypeScript compiler.
const TS_URL = 'https://esm.sh/typescript'

let tsPromise: Promise<unknown> | null = null
const getTs = () => (tsPromise ??= import(/* @vite-ignore */ TS_URL))

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function transpileTs(source: string, tsx = false): Promise<string> {
  const ts = await getTs() as any
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: tsx ? ts.JsxEmit.Preserve : ts.JsxEmit.None,
    },
  })
  return result.outputText as string
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

/**
 * Console relay, injected into every previewed document.
 *
 * Posts to `window.parent`, deliberately NOT `window.top`.
 *
 * `top` is the outermost frame, which is the playground only while the playground is not
 * itself embedded. Put it in an iframe - the admin review pane, a course page, several
 * playgrounds side by side - and `top` becomes the wrapper: every preview then shouts its
 * logs at a page that is not listening, each playground's own console pane stays empty,
 * and with more than one instance the streams arrive mixed together and unattributable.
 *
 * `parent` is exactly one hop, and both modes are arranged so one hop is right: a
 * browser-mode preview's parent is the shim, which forwards upward; a node-mode preview's
 * parent is the app itself.
 *
 * The target origin is our own, because `parent` always shares it - a srcdoc child inherits
 * the shim's origin, and a node preview is served from the app's. No argument needed, which
 * also removes the chance of passing the wrong one.
 */
export function consoleRelayScript(): string {
  return `<script>
;(function(){
  // Fallback covers a browser that hands srcdoc an opaque origin. '*' relaxes the
  // receiver-origin assertion but cannot broadcast: the destination window is fixed.
  var _target = (location.origin && location.origin !== 'null') ? location.origin : '*'
  // Errors and DOM nodes JSON.stringify to "{}" (non-enumerable props) - format them
  // explicitly so students actually see what went wrong.
  var _fmt = function(a) {
    try {
      if (a instanceof Error) return (a.name || 'Error') + ': ' + a.message
      if (a instanceof Node) return a.outerHTML != null ? a.outerHTML : String(a)
      return typeof a === 'object' ? JSON.stringify(a) : String(a)
    } catch (e) { return String(a) }
  }
  var _post = function(type, args) {
    window.parent.postMessage({
      source: 'playground-console',
      type: type,
      message: Array.from(args).map(_fmt).join(' ')
    }, _target)
  }
  console.log   = function() { _post('info',  arguments) }
  console.info  = function() { _post('info',  arguments) }
  console.warn  = function() { _post('warn',  arguments) }
  console.error = function() { _post('error', arguments) }
  window.addEventListener('error', function(e) {
    // Module files are served as blob: URLs whose names are opaque UUIDs - only the line
    // number is meaningful in that case.
    var loc = !e.filename ? ''
      : e.filename.indexOf('blob:') === 0 ? ' (line ' + e.lineno + ')'
      : ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')'
    _post('error', [e.message + loc])
  })
  window.addEventListener('unhandledrejection', function(e) {
    var r = e.reason
    _post('error', ['Unhandled promise rejection: ' + (r instanceof Error ? r.message : String(r))])
  })
})()
</script>`
}

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
    .replace(/<head[^>]*>/i, match => match + consoleRelayScript())
}
