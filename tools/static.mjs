// Dev-only static file server, one instance per origin that only needs to hand back
// files. Used for apps/preview so student code runs on its own host in development,
// exactly as it will in production.
//
// Deliberately dependency-free: adding `serve` or `http-server` to the workspace for
// twenty lines of well-understood code is not a trade worth making.
//
//   node tools/static.mjs <dir> <port>
//
// CORS is wide open because the whole point of this origin is to be embedded by another
// one, and there is nothing here worth protecting - it serves a shim that executes
// whatever the editor sends it.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'

const [, , dirArg, portArg] = process.argv
if (!dirArg || !portArg) {
  console.error('usage: node tools/static.mjs <dir> <port>')
  process.exit(1)
}

const root = resolve(dirArg)
const port = Number(portArg)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const requested = decodeURIComponent(url.pathname)

  // Resolve first, then confirm the result is still inside root. Checking the raw path for
  // '..' is the version of this that keeps getting bypassed.
  const target = resolve(join(root, requested === '/' ? '/index.html' : requested))
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const info = await stat(target)
    const file = info.isDirectory() ? join(target, 'index.html') : target
    const body = await readFile(file)
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      // Never let dev cache a shim or a service worker; both are edited constantly.
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
}).listen(port, () => {
  console.log(`static  ${dirArg}  ->  http://localhost:${port}  (also *.localhost)`)
})
