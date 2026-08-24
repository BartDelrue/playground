// Encode a directory of files into a playground share-URL hash.
// The reverse of tools/decode-hash.mjs.
//
// Usage:
//   node tools/encode-hash.mjs [inputPath...] [options]
//
//   inputPath    dir (walked recursively) or file; defaults to "decoded"
//   --url <base> print a full share URL instead of the bare hash
//   --entry <p>  put this file first in the snapshot — the playground opens
//                Object.keys(files)[0] by default
//   --out <file> also write the hash/URL to a file
//   --zlib       zlib wrapper + standard base64 (the "eNq…" format some
//                deployed/@vue/repl hashes use) instead of deflate-raw + base64url
//
// Default output is URL-safe base64 over deflate-raw JSON ({ "path": "content", ... }),
// the format loadHash() in app/helper/index.ts expects.

import {deflateRawSync, deflateSync} from 'zlib'
import {readFileSync, writeFileSync, readdirSync, statSync, existsSync} from 'fs'
import {join, relative, sep} from 'path'

const SKIP = new Set(['node_modules', '.git', '.nuxt', '.output', 'dist'])

const argv = process.argv.slice(2)
const roots = []
const opts = {}
for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--zlib') opts.zlib = true
    else if (a === '--url' || a === '--entry' || a === '--out') opts[a.slice(2)] = argv[++i]
    else if (a.startsWith('-')) {
        console.error(`Unknown option: ${a}`)
        process.exit(1)
    } else roots.push(a)
}
if (!roots.length) roots.push('decoded')

// Collect [key, content] pairs. Keys are POSIX-style paths relative to the
// directory root they were found under, so decode → encode round-trips.
function walk(dir, base, out) {
    for (const name of readdirSync(dir).sort()) {
        if (SKIP.has(name)) continue
        const full = join(dir, name)
        if (statSync(full).isDirectory()) walk(full, base, out)
        else out.push([relative(base, full).split(sep).join('/'), readFileSync(full, 'utf8')])
    }
}

const entries = []
for (const root of roots) {
    if (!existsSync(root)) {
        console.error(`No such path: ${root}`)
        process.exit(1)
    }
    if (statSync(root).isDirectory()) walk(root, root, entries)
    else entries.push([root.split(sep).join('/'), readFileSync(root, 'utf8')])
}
if (!entries.length) {
    console.error(`No files found in ${roots.join(', ')}`)
    process.exit(1)
}

if (opts.entry) {
    const i = entries.findIndex(([k]) => k === opts.entry)
    if (i < 0) {
        console.error(`--entry ${opts.entry} is not one of the collected files`)
        process.exit(1)
    }
    entries.unshift(...entries.splice(i, 1))
}

const json = JSON.stringify(Object.fromEntries(entries))
const deflated = opts.zlib
    ? deflateSync(Buffer.from(json, 'utf8'), {level: 9})
    : deflateRawSync(Buffer.from(json, 'utf8'), {level: 9})
const hash = opts.zlib
    ? deflated.toString('base64')
    : deflated.toString('base64url').replace(/=/g, '')

for (const [name, content] of entries) console.error(name, '-', content.length, 'chars')
console.error(`\n${entries.length} files, ${json.length} chars JSON -> ${hash.length} chars hash`)

const result = opts.url ? `${opts.url.replace(/#.*$/, '').replace(/\/$/, '')}/#${hash}` : hash
if (opts.out) {
    writeFileSync(opts.out, result)
    console.error(`written to ${opts.out}`)
}
console.log(result)
