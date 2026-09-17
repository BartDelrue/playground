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
  linkTarget,
  transpileTs,
  isConsoleMessage,
  isNavigateMessage,
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

/** The snapshot on screen, kept so a link click can re-render without asking the app. */
let snapshot: FileSnapshot = {}

/** Which file the stage is showing. Relative links resolve against it, so it is a path. */
let entryFile = ''

function post(type: 'ready' | 'rendered' | 'error', message?: string): void {
  if (!appOrigin) return
  parent.postMessage({ source: 'playground-preview', type, message }, appOrigin)
}

async function compile(filename: string, source: string): Promise<string> {
  if (filename.endsWith('.ts')) return transpileTs(source)
  if (filename.endsWith('.tsx')) return transpileTs(source, true)
  return source
}

/**
 * Which file to treat as the document.
 *
 * The page the student navigated to outranks the snapshot's first .html, because every
 * keystroke in the editor sends a fresh snapshot: without this, typing while two pages
 * deep would throw the preview back to the front page on every character. Restart still
 * goes home - it reloads this frame, and the state lives here.
 */
function pickEntry(files: FileSnapshot, requested?: string): string {
  if (requested && files[requested] !== undefined) return requested
  if (entryFile && files[entryFile] !== undefined) return entryFile
  return Object.keys(files).find(name => name.endsWith('.html')) ?? 'index.html'
}

/**
 * Follow a link the previewed document handed back.
 *
 * A link out of the snapshot only gets a console line: the alternative is covering the
 * preview with the status overlay, and since the frame has no history there would then be
 * no way back to the page the student was on. The line names the href, which is what they
 * need to see - usually a typo, or a file they have not made yet.
 */
function navigate(href: string): void {
  const target = linkTarget(entryFile, href, snapshot)
  if (!target) {
    post('error', `Cannot follow "${href}": there is no such file in this playground.`)
    return
  }
  void render({ source: 'playground-preview', type: 'render', files: snapshot, entry: target })
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
    const entry = pickEntry(files, msg.entry)
    const source = files[entry] ?? '<html><head></head><body></body></html>'

    // navigation: this is the only place a snapshot is rendered without a server under
    // it, so this is the only place link clicks have to be intercepted.
    const html = buildHtml(source, entry, files, urlMap, { navigation: true })

    // srcdoc keeps the child on this origin, so its own blob: imports resolve.
    frame.srcdoc = html
    status.hidden = true
    liveBlobs = blobs
    // Recorded only once the document is actually on screen, so a failed render leaves
    // the previous page navigable.
    snapshot = files
    entryFile = entry
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

  // A link click in the previewed document. Same one hop, same window-reference check as
  // the console relay, and for the same reason: only the document we rendered may steer
  // this frame.
  if (isNavigateMessage(event.data)) {
    if (event.source !== frame.contentWindow) return
    navigate(event.data.href)
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
