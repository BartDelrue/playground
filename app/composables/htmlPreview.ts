import {makePreviewBase, buildModuleUrls, buildHtml, transpileTs} from '~/utils/bundler'

async function compile(filename: string, src: string): Promise<string> {
  if (filename.endsWith('.ts')) return transpileTs(src)
  if (filename.endsWith('.tsx')) return transpileTs(src, true)
  return src
}

export function useHtmlPreview(files: Record<string, string>) {
  const {previewUrl, isBooting, bootStatus, wc, onLog, pushLog, revoke, mkblob} = makePreviewBase()

  async function updatePreview() {
    if (!import.meta.client) return
    revoke()
    try {
      const urlMap = await buildModuleUrls(files, mkblob, compile)
      const htmlName = Object.keys(files).find(k => k.endsWith('.html')) ?? 'index.html'
      const htmlSrc = files[htmlName] ?? '<html><head></head><body></body></html>'
      previewUrl.value = mkblob(buildHtml(htmlSrc, htmlName, files, urlMap), 'text/html')
    } catch (e) {
      pushLog(String(e), LogType.ERROR)
    }
  }

  watch(() => ({...files}), updatePreview, {deep: true})

  const previewKey = ref(0)
  return {onLog, wc, previewUrl, previewKey, isBooting, bootStatus, boot: updatePreview, restart: updatePreview}
}
