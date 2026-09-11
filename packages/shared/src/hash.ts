/**
 * Share-URL hash codec.
 *
 * A snapshot of the editor's files is JSON-encoded, deflated and base64'd into the URL
 * fragment. These functions are deliberately pure - they never touch `location` - so the
 * admin portal can decode a submitted link server-side to list its files without
 * pretending to be a browser. The playground's thin `location` wrapper lives in
 * apps/playground/app/helper.
 *
 * Both CompressionStream and DecompressionStream are available in browsers and in Node
 * 18+, so this one file serves the client and the Nitro server unchanged.
 */

export type FileSnapshot = Record<string, string>

/**
 * Both hash formats in circulation wrap the same JSON payload, so there is no header to
 * tell them apart - the only reliable test is to inflate and see which yields parseable
 * JSON:
 *
 *   deflate-raw  what encodeHash() below writes.
 *   deflate      the zlib-wrapped "eN.." form. @vue/repl serializes this way, so trying
 *                it second makes a play.vuejs.org share link openable in vue mode.
 *
 * Ordering matters only for speed: our own format is by far the common case.
 */
const HASH_FORMATS = ['deflate-raw', 'deflate'] as const

function concat(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk)
  return concat(chunks)
}

async function inflate(bytes: Uint8Array<ArrayBuffer>, format: typeof HASH_FORMATS[number]): Promise<string | null> {
  try {
    const ds = new DecompressionStream(format)
    const writer = ds.writable.getWriter()
    // A format mismatch rejects on BOTH sides of the stream. The error is surfaced by
    // reading the readable, so the write side is swallowed here to keep it off the
    // unhandled-rejection channel - otherwise probing the wrong format first logs a
    // spurious error for what is a normal part of detection.
    void writer.write(bytes).catch(() => {})
    void writer.close().catch(() => {})
    return new TextDecoder().decode(await collect(ds.readable))
  } catch {
    return null
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64Any(raw: string): Uint8Array<ArrayBuffer> | null {
  try {
    // Standard base64 contains neither '-' nor '_', so undoing the URL-safe alphabet is a
    // no-op on a zlib hash and both formats decode through this one path. Re-pad because
    // encodeHash strips '='.
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Compress a file snapshot into a URL-safe fragment (without the leading '#'). */
export async function encodeHash(files: FileSnapshot): Promise<string> {
  const cs = new CompressionStream('deflate-raw')
  const writer = cs.writable.getWriter()
  void writer.write(new TextEncoder().encode(JSON.stringify(files))).catch(() => {})
  void writer.close().catch(() => {})
  return toBase64Url(await collect(cs.readable))
}

/**
 * Decode a fragment back into a file snapshot, or null if it is not a playground hash.
 * Accepts a bare hash, a '#'-prefixed fragment, or a whole URL.
 */
export async function decodeHash(input: string): Promise<FileSnapshot | null> {
  const raw = (input.includes('#') ? input.slice(input.lastIndexOf('#') + 1) : input).trim()
  if (!raw) return null

  const bytes = fromBase64Any(raw)
  if (!bytes) return null

  for (const format of HASH_FORMATS) {
    const json = await inflate(bytes, format)
    if (json === null) continue
    try {
      const parsed: unknown = JSON.parse(json)
      // Inflating with the wrong format can succeed and yield garbage, so the parse is
      // part of the detection rather than mere validation. Only a plain object of strings
      // counts as a hit.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as FileSnapshot
      }
    } catch { /* wrong format - try the next */ }
  }
  return null
}

/**
 * Which playground mode a snapshot belongs to, judged by its file names. The admin portal
 * uses this to link a submission straight at the right route instead of guessing.
 */
export type PlaygroundMode = 'browser' | 'vue' | 'node'

export function detectMode(files: FileSnapshot): PlaygroundMode {
  const names = Object.keys(files)
  if (names.some(n => n === 'package.json' || n.startsWith('server/'))) return 'node'
  if (names.some(n => n.endsWith('.vue') || n === 'import-map.json' || n === 'importmap.json')) return 'vue'
  return 'browser'
}

/** Route prefix for a mode. Browser mode is the default and owns the root. */
export function routeForMode(mode: PlaygroundMode): string {
  return mode === 'browser' ? '/' : `/${mode}`
}
