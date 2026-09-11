import { decodeHash, encodeHash, type FileSnapshot } from '@playground/shared'

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

/**
 * The codec itself lives in @playground/shared so the admin portal can decode a submitted
 * link without pretending to be a browser. These two are the only parts that need a
 * `location`, which is why they stayed here.
 */

export async function saveHash(snapshot: FileSnapshot): Promise<void> {
  if (!import.meta.client) return;
  try {
    history.replaceState(null, '', '#' + await encodeHash(snapshot));
  } catch (e) {
    console.warn('saveHash:', e);
  }
}

export async function loadHash(): Promise<FileSnapshot | null> {
  if (!import.meta.client) return null;
  return decodeHash(location.hash.slice(1));
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
  // @vue/repl's store types its import map values as possibly undefined, so accept that
  // and skip the empties rather than making every caller assert.
  imports: Record<string, string | undefined> | undefined,
): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const [specifier, url] of Object.entries(imports ?? {})) {
    if (!url) continue;
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
