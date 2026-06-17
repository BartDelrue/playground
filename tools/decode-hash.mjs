// Decode a playground share-URL hash into its files.
//
// Usage:
//   node tools/decode-hash.mjs "<url-or-hash>" [outputDir]
//   node tools/decode-hash.mjs urls.txt [outputDir]   (file containing the URL)
//
// The hash is URL-safe base64 over deflate-raw JSON ({ "path": "content", ... }),
// the same format produced by saveHash() in app/helper/index.ts.

import { inflateRawSync } from 'zlib'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'

const [, , input, outDir = 'decoded'] = process.argv
if (!input) {
  console.error('Usage: node tools/decode-hash.mjs "<url-or-hash>" [outputDir]')
  process.exit(1)
}

const source = existsSync(input) ? readFileSync(input, 'utf8') : input
// Take the longest base64url run in the input — tolerates a full URL,
// a bare hash, or surrounding text.
const runs = source.match(/[A-Za-z0-9_-]{40,}/g) ?? []
const hash = runs.sort((a, b) => b.length - a.length)[0]
if (!hash) {
  console.error('No hash found in input')
  process.exit(1)
}

const b64 = hash.replace(/-/g, '+').replace(/_/g, '/')
const json = inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8')
const files = JSON.parse(json)

for (const [name, content] of Object.entries(files)) {
  const out = join(outDir, name)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, content)
  console.log(out, '-', content.length, 'chars')
}
console.log(`\n${Object.keys(files).length} files written to ${outDir}/`)
