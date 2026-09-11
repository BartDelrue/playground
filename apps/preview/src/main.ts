/**
 * Browser-mode preview shim.
 *
 * Runs on the preview origin and nothing else runs here. The app posts a file snapshot
 * in; this bundles it and writes the resulting document into a nested iframe.
 *
 * Why a nested iframe rather than document.write into this page: the shim has to survive
 * every re-render to keep receiving messages. Replacing its own document would tear down
 * the message listener with it, so the shim stays put and swaps the child.
 *
 * Both frames are on this origin, so the blob URLs the bundler mints inherit it - which
 * is the entire point of the exercise. The app's origin is never reachable from student
 * code here.
 */

import {
  buildHtml,
  buildModuleUrls,
  transpileTs,
  isConsoleMessage,
  isPreviewMessage,
  type FileSnapshot,
  type RenderMessage,
} from '@playground/shared'

/** The app origin, learned from the first message rather than baked in at build time. */
let appOrigin: string | null = null

const frame = document.getElementById('stage') as HTMLIFrameElement
const status = document.getElementById('status') as HTMLElement

/** Blob URLs from the previous render, revoked once the new document has replaced it. */
let liveBlobs: string[] = []

function post(type: 'ready' | 'rendered' | 'error', message?: string): void {
  if (!appOrigin) return
  parent.postMessage({ source: 'playground-preview', type, message }, appOrigin)
}

async function compile(filename: string, source: string): Promise<string> {
  if (filename.endsWith('.ts')) return transpileTs(source)
  if (filename.endsWith('.tsx')) return transpileTs(source, true)
  return source
}

async function render(msg: RenderMessage): Promise<void> {
  const files: FileSnapshot = msg.files ?? {}
  const previousBlobs = liveBlobs
  const blobs: string[] = []

  const mkblob = (code: string, type = 'text/javascript'): string => {
    const url = URL.createObjectURL(new Blob([code], { type }))
    blobs.push(url)
    return url
  }

  try {
    const urlMap = await buildModuleUrls(files, mkblob, compile)
    const entry = msg.entry && files[msg.entry]
      ? msg.entry
      : Object.keys(files).find(name => name.endsWith('.html')) ?? 'index.html'
    const source = files[entry] ?? '<html><head></head><body></body></html>'

    const html = buildHtml(source, entry, files, urlMap)

    // srcdoc keeps the child on this origin, so its own blob: imports resolve.
    frame.srcdoc = html
    status.hidden = true
    liveBlobs = blobs
    post('rendered')
  } catch (error) {
    blobs.forEach(URL.revokeObjectURL)
    const text = error instanceof Error ? error.message : String(error)
    status.hidden = false
    status.textContent = text
    post('error', text)
    return
  }

  // Revoke the previous render's URLs only after the replacement is in place; doing it
  // first can pull a module out from under a document that is still tearing down.
  setTimeout(() => previousBlobs.forEach(URL.revokeObjectURL), 1000)
}

window.addEventListener('message', event => {
  // Console output from the student's document, on its way to the app's console pane.
  //
  // The relay in there posts to its parent, which is this shim - one hop, so it works no
  // matter how deeply the playground itself is embedded. Forwarding it on is this frame's
  // second job.
  //
  // Identified by window reference rather than by origin: a srcdoc child inherits our
  // origin in every browser that matters, but some hand it an opaque one, and comparing
  // `event.source` to the frame we created is exact either way. It also means a page that
  // framed us cannot inject console lines into someone's pane.
  if (isConsoleMessage(event.data)) {
    if (event.source !== frame.contentWindow) return
    if (appOrigin) parent.postMessage(event.data, appOrigin)
    return
  }

  if (!isPreviewMessage(event.data)) return

  // First contact defines the peer. Everything after must match it, so a second frame
  // cannot start driving this shim once the app has claimed it.
  if (appOrigin === null) appOrigin = event.origin
  else if (event.origin !== appOrigin) return

  if (event.data.type === 'render') void render(event.data)
})

// The app cannot know when a cross-origin child has finished loading, so the shim says so.
// It has no peer yet, hence the wildcard: this single message carries no data, and the app
// only listens for it while booting a preview.
parent.postMessage({ source: 'playground-preview', type: 'ready' }, '*')
