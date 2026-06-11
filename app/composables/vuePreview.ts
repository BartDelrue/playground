import {makePreviewBase, buildModuleUrls, buildHtml, transpileTs} from '~/utils/bundler'

let _compiler: Promise<typeof import('@vue/compiler-sfc')> | null = null
const getCompiler = () => (_compiler ??= import('@vue/compiler-sfc'))

async function compileSfc(filename: string, source: string): Promise<string> {
  const {parse, compileScript, compileTemplate, compileStyle} = await getCompiler()
  const id = filename.replace(/\W/g, '_')
  const {descriptor, errors} = parse(source, {filename})
  if (errors.length) throw new Error(String(errors[0]))

  const hasScript = !!(descriptor.script || descriptor.scriptSetup)
  const script = hasScript
    ? compileScript(descriptor, {id, genDefaultAs: '__sfc__'})
    : {content: 'const __sfc__ = {}', bindings: {} as Record<string, string>}

  const isScoped = descriptor.styles.some(s => s.scoped)
  const tmpl = descriptor.template
    ? compileTemplate({
        source: descriptor.template.content,
        filename, id, scoped: isScoped,
        compilerOptions: {bindingMetadata: script.bindings},
      })
    : null

  const styleCode = descriptor.styles.map(s => {
    try { return compileStyle({source: s.content, filename, id, scoped: s.scoped ?? false}).code }
    catch { return s.content }
  }).join('\n')

  return [
    script.content,
    tmpl?.code ?? '',
    tmpl ? '__sfc__.render = render' : '',
    styleCode ? `const __s=document.createElement('style');__s.textContent=${JSON.stringify(styleCode)};document.head.appendChild(__s)` : '',
    'export default __sfc__',
  ].filter(Boolean).join('\n')
}

async function compile(filename: string, src: string): Promise<string> {
  if (filename.endsWith('.vue')) return compileSfc(filename, src)
  if (filename.endsWith('.ts')) return transpileTs(src)
  if (filename.endsWith('.tsx')) return transpileTs(src, true)
  return src
}

export function useVuePreview(files: Record<string, string>) {
  const {previewUrl, isBooting, bootStatus, wc, onLog, pushLog, revoke, mkblob} = makePreviewBase()

  async function updatePreview() {
    if (!import.meta.client) return
    revoke()
    try {
      const urlMap = await buildModuleUrls(files, mkblob, compile)
      const htmlName = Object.keys(files).find(k => k.endsWith('.html')) ?? 'index.html'
      const htmlSrc = files[htmlName] ?? '<html><head></head><body><div id="app"></div></body></html>'
      previewUrl.value = mkblob(buildHtml(htmlSrc, htmlName, files, urlMap), 'text/html')
    } catch (e) {
      pushLog(String(e), true)
    }
  }

  watch(() => ({...files}), updatePreview, {deep: true})

  const previewKey = ref(0)
  return {onLog, wc, previewUrl, previewKey, isBooting, bootStatus, boot: updatePreview, restart: updatePreview}
}
