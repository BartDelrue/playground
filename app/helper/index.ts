export function getLanguage(filepath: string): string {
  const ext = (filepath.split('.').pop() ?? '').toLowerCase();
  return ({
    js: 'javascript', ts: 'typescript',
    jsx: 'javascript', tsx: 'typescript',
    html: 'html', css: 'css', scss: 'scss',
    json: 'json', md: 'markdown',
    vue: 'vue', svelte: 'html',
    sh: 'shell', py: 'python',
  } as Record<string, string>)[ext] ?? 'plaintext';
}

// Concatenate the chunks a (De)CompressionStream emitted into one buffer.
function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export async function saveHash(snapshot: Record<string, string>): Promise<void> {
  if (!import.meta.client) return;
  try {
    const json = JSON.stringify(snapshot);
    const input = new TextEncoder().encode(json);
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();
    const chunks: Uint8Array[] = [];
    for await (const chunk of cs.readable) chunks.push(chunk);
    const bytes = concat(chunks);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    history.replaceState(null, '', '#' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''));
  } catch (e) {
    console.warn('saveHash:', e);
  }
}

// Both hash formats in circulation wrap the same JSON payload, so the only way to tell
// them apart is to try inflating and see which one yields parseable JSON:
//
//   deflate-raw  what saveHash() above writes.
//   deflate      the zlib-wrapped "eNq…" form. @vue/repl serializes this way, and it is
//                what the deployed browser/node builds produced before saveHash switched
//                to raw — so every share link already handed out is in this format.
//
// Trying both keeps those old links (exercise URLs, ?key= exam submissions) opening, and
// makes a @vue/repl hash portable into node/browser mode for free. Do not "simplify" this
// back to a single format without re-encoding whatever is still in circulation.
const HASH_FORMATS = ['deflate-raw', 'deflate'] as const;

async function inflate(bytes: Uint8Array, format: typeof HASH_FORMATS[number]): Promise<string | null> {
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    // A format mismatch rejects on BOTH sides of the stream. We surface it by reading the
    // readable, so the write side is swallowed here to keep it off the unhandled-rejection
    // channel — otherwise probing the wrong format first logs a spurious console error.
    void writer.write(bytes).catch(() => {});
    void writer.close().catch(() => {});
    const chunks: Uint8Array[] = [];
    for await (const chunk of ds.readable) chunks.push(chunk);
    return new TextDecoder().decode(concat(chunks));
  } catch {
    return null;
  }
}

export async function loadHash(): Promise<Record<string, string> | null> {
  if (!import.meta.client) return null;
  const raw = location.hash.slice(1);
  if (!raw) return null;

  let bytes: Uint8Array;
  try {
    // Standard base64 contains neither '-' nor '_', so undoing the URL-safe alphabet is a
    // no-op on a zlib hash and both formats decode through this one path. Re-pad because
    // saveHash strips '='.
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null; // not base64 at all
  }

  for (const format of HASH_FORMATS) {
    const json = await inflate(bytes, format);
    if (json === null) continue;
    try {
      const parsed: unknown = JSON.parse(json);
      // Inflating with the wrong format can still succeed and yield garbage, so the parse
      // is part of the detection, not just validation.
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, string>;
    } catch { /* wrong format — try the next one */ }
  }
  return null;
}

// @vue/repl's Volar worker fetches .d.ts files for bare imports from unpkg, using
// `store.dependencyVersion` to decide which version of each package to pull. Anything
// missing from that map falls back to `latest`, which drifts from whatever the import
// map actually loads at runtime — vue-router@4 in the import map but vue-router@5 types
// in the editor. Deriving the versions from the import map keeps the two in step: add a
// CDN dependency there and its type hints follow automatically.
//
// Matches the `<pkg>@<version>` segment of an esm.sh / unpkg / jsdelivr URL. Only pins a
// package when the parsed name equals the bare specifier, so a subpath entry
// (`vue/jsx-runtime` -> `.../@vue/runtime-dom@3...`) is skipped rather than mispinned;
// those fall back to `latest`, which is the safer direction to be wrong in.
const CDN_PKG_VERSION = /^\/(?:npm\/)?((?:@[^/@]+\/)?[^/@]+)@([^/]+)/;

export function dependencyVersionsFromImportMap(
  imports: Record<string, string> | undefined,
): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const [specifier, url] of Object.entries(imports ?? {})) {
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      continue; // relative or malformed URL — no version to pin
    }
    const match = CDN_PKG_VERSION.exec(pathname);
    if (match && match[1] === specifier) versions[specifier] = match[2]!;
  }
  return versions;
}
