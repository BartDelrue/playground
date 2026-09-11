import { isPreviewMessage, type FileSnapshot } from '@playground/shared'
import type { FsProvider } from '~/composables/files'

/**
 * Browser-mode preview.
 *
 * The app no longer bundles anything here. It points an iframe at the preview origin and
 * posts the file snapshot across; the shim over there mints the blob URLs so they inherit
 * ITS origin, not ours. Student code therefore cannot touch this document.
 *
 * The shim's window is captured from its own `ready` message rather than by reaching for
 * the iframe element, which keeps this composable out of the layout's DOM entirely - the
 * layout owns the frame, we only talk to whatever announces itself.
 */
export function useHtmlPreview(files: Record<string, string>) {
  const config = useRuntimeConfig()
  const previewOrigin = String(config.public.previewOrigin || '')

  const previewUrl = ref('')
  const previewKey = ref(0)
  const isBooting = ref(false)
  const bootStatus = ref('')
  // Browser mode has no virtual filesystem; the ref exists only to satisfy the shared
  // PreviewApi shape that node mode fills in.
  const wc = shallowRef<FsProvider | null>(null)

  type LogHandler = (text: string, type?: LogType) => void
  const logHandlers: LogHandler[] = []
  const onLog = (handler: LogHandler) => logHandlers.push(handler)
  const pushLog = (text: string, type: LogType = LogType.INFO) => logHandlers.forEach(h => h(text, type))

  let shim: Window | null = null
  /** Set while we are waiting for the shim, so the first snapshot is not dropped. */
  let queued: FileSnapshot | null = null

  function send(snapshot: FileSnapshot): void {
    if (!shim) {
      queued = snapshot
      return
    }
    shim.postMessage({ source: 'playground-preview', type: 'render', files: snapshot }, previewOrigin)
  }

  function onMessage(event: MessageEvent): void {
    if (event.origin !== previewOrigin) return
    if (!isPreviewMessage(event.data)) return

    if (event.data.type === 'ready') {
      // Re-captured on every reload of the frame, so a remount does not leave us posting
      // into a dead window.
      shim = event.source as Window | null
      isBooting.value = false
      bootStatus.value = ''
      send(queued ?? { ...files })
      queued = null
      return
    }

    if (event.data.type === 'error' && event.data.message) {
      pushLog(event.data.message, LogType.ERROR)
    }
  }

  onMounted(() => addEventListener('message', onMessage))
  onUnmounted(() => {
    removeEventListener('message', onMessage)
    shim = null
  })

  watch(() => ({ ...files }), snapshot => send(snapshot), { deep: true })

  function boot(): void {
    if (!previewOrigin) {
      pushLog('NUXT_PUBLIC_PREVIEW_ORIGIN is not set, so there is nowhere to run the preview.', LogType.ERROR)
      return
    }
    isBooting.value = true
    bootStatus.value = 'Starting preview…'
    shim = null
    queued = { ...files }
    previewUrl.value = previewOrigin + '/'
  }

  function restart(): void {
    shim = null
    queued = { ...files }
    // Force the layout to remount the frame; the shim announces itself again on load.
    previewKey.value++
  }

  return { onLog, wc, previewUrl, previewKey, isBooting, bootStatus, boot, restart }
}
