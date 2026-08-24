// Decode a playground share-URL hash into its files.
//
// Usage:
//   node tools/decode-hash.mjs "<url-or-hash>" [outputDir]
//   node tools/decode-hash.mjs urls.txt [outputDir]   (file containing the URL)
//
// Two hash formats are auto-detected:
//   deflate-raw + URL-safe base64  — what saveHash() in app/helper/index.ts produces
//   zlib + standard base64         — the "eNq…" form used by @vue/repl / deployed links
// Both wrap the same JSON payload ({ "path": "content", ... }).
//
// tools/encode-hash.mjs is the reverse of this tool.

import { inflateRawSync, inflateSync } from 'zlib'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'

const [, , input, outDir = 'decoded'] = process.argv
if (!input) {
  console.error('Usage: node tools/decode-hash.mjs "<url-or-hash>" [outputDir]')
  process.exit(1)
}

const source = existsSync(input) ? readFileSync(input, 'utf8') : input
// Prefer whatever follows the last '#' — a standard-base64 hash contains '/',
// which the run heuristic below can otherwise confuse with a long URL path.
const region = source.includes('#') ? source.slice(source.lastIndexOf('#') + 1) : source
// Take the longest base64 run — tolerates a full URL, a bare hash, or
// surrounding text, in either alphabet.
const pick = (s) => (s.match(/[A-Za-z0-9_+/=-]{40,}/g) ?? []).sort((a, b) => b.length - a.length)[0]
const hash = pick(region) ?? pick(source)
if (!hash) {
  console.error('No hash found in input')
  process.exit(1)
}

// Node's base64 decoder is lenient about the alphabet, but normalise anyway so
// the intent is explicit.
const bytes = Buffer.from(hash.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

// A zlib stream starts with a CMF/FLG pair: low nibble 8 (deflate) and a
// big-endian value divisible by 31. Try the likelier codec first, but validate
// both by parsing — inflateRawSync on zlib input can yield garbage instead of
// throwing.
const looksZlib = bytes.length > 1 && (bytes[0] & 0x0f) === 8 && ((bytes[0] << 8) + bytes[1]) % 31 === 0
const codecs = looksZlib
  ? [['zlib', inflateSync], ['deflate-raw', inflateRawSync]]
  : [['deflate-raw', inflateRawSync], ['zlib', inflateSync]]

let files, format
for (const [name, inflate] of codecs) {
  try {
    const parsed = JSON.parse(inflate(bytes).toString('utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      files = parsed
      format = name
      break
    }
  } catch { /* wrong codec — try the next */ }
}
if (!files) {
  console.error('Hash is not a deflate-raw or zlib compressed JSON snapshot')
  process.exit(1)
}
console.log(`format: ${format}\n`)

for (const [name, content] of Object.entries(files)) {
  const out = join(outDir, name)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, content)
  console.log(out, '-', content.length, 'chars')
}
console.log(`\n${Object.keys(files).length} files written to ${outDir}/`)
