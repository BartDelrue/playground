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
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) { bytes.set(c, off); off += c.length; }
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
    history.replaceState(null, '', '#' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''));
  } catch (e) {
    console.warn('saveHash:', e);
  }
}

export async function loadHash(): Promise<Record<string, string> | null> {
  if (!import.meta.client) return null;
  const raw = location.hash.slice(1);
  if (!raw) return null;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const chunks: Uint8Array[] = [];
    for await (const chunk of ds.readable) chunks.push(chunk);
    const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return JSON.parse(new TextDecoder().decode(out)) as Record<string, string>;
  } catch {
    return null;
  }
}
