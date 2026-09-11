// https://nuxt.com/docs/api/configuration/nuxt-config
import {resolve, join} from 'node:path'
import {existsSync, readFileSync} from 'node:fs'
import type {IncomingMessage, ServerResponse} from 'node:http'

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    ssr: false,
    devtools: {enabled: true},

    // One build, three routes. This used to be three builds selected by a
    // VITE_PREVIEW_MODE define; the mode is now a property of the route, and each page
    // sets its own title and favicon through PlaygroundShell.
    app: {
        head: {
            title: 'Playground',
            htmlAttrs: {lang: 'en'},
            link: [{rel: 'icon', type: 'image/svg+xml', href: '/favicon-browser.svg'}],
        },
    },

    // Off in production. This build pulls in Monaco, @vue/repl (which carries its own
    // Monaco and Volar) and almostnode all at once - the cost of one build serving three
    // modes - and holding sourcemaps for that graph in memory is what pushed `nuxt
    // generate` past a 2 GB heap on the build server. Nobody debugs minified production
    // output here anyway.
    sourcemap: {client: false, server: false},

    modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxt/test-utils'],
    css: ['~/assets/main.css'],

    // @playground/shared ships as raw TypeScript with no build step, so it has to be
    // transpiled rather than treated as an external dependency.
    build: {transpile: ['@playground/shared']},

    runtimeConfig: {
        public: {
            // Where browser-mode student code executes. A different origin, so the blob
            // URLs it mints cannot reach this document.
            previewOrigin: '',
            // Where the submit endpoint lives (the admin app).
            apiOrigin: '',
        },
    },

    nitro: {
        // @vue/repl ships its workers as `"" + new URL("assets/…", import.meta.url).href`.
        // The leading `"" +` stops Vite from recognising them as worker assets, so they are
        // never emitted and requests for /_nuxt/assets/*.js return empty / no MIME type.
        // Without this the built app 404s on /_nuxt/assets/vue.worker-*.js, Volar never
        // boots, and the editor loses ALL IntelliSense (completions, hover types, signature
        // help, diagnostics) — dev looks fine, prod does not.
        //
        // Mounted straight from the package so a @vue/repl upgrade cannot leave a stale
        // content hash behind. ~6 MB. This used to be gated on the vue build; with a single
        // output it always ships, and it stays a static file fetched on demand, so a
        // browser- or node-mode visitor still downloads none of it.
        publicAssets: [
            {dir: resolve('./node_modules/@vue/repl/dist/assets'), baseURL: '/_nuxt/assets'},
        ],
    },

    // Third @vue/repl workaround, this one a package patch rather than config —
    // patches/@vue__repl@4.7.2.patch, applied via pnpm `patchedDependencies`.
    // Its worker's completion proxy compared a GENERATED offset against the SFC's SOURCE
    // <template>/<style> ranges, so a caret in <script setup> was frequently mistaken for one
    // inside a block and had the macros (defineProps/defineEmits/…) plus JS globals stripped
    // from its completions. Whether it misfired depended on where the generated offset happened
    // to land, which is why it looked arbitrary — any SFC with a <style> block was a likely
    // victim. The patch drops that positional filter; the only cost is cosmetic suggestion noise
    // inside templates. Upstream as of @vue/repl 4.7.2 (play.vuejs.org ships the same worker and
    // is affected too) — the patch is version-pinned, so an upgrade fails loudly. Recheck then.

    // Dev-time half of the publicAssets fix above: serve @vue/repl's workers from its dist.
    //
    // Deliberately a `vite:serverCreated` hook, not a vite.plugins entry: registering this as a
    // plugin trips a Vite bug (EnvironmentPluginContainer.transform infinite recursion). The hook
    // adds middleware after the server exists, sidestepping that path.
    // Still required as of @vue/repl 4.7.2 + vite 7.3.5 — recheck if either is upgraded.
    hooks: {
        'vite:serverCreated'(server) {
            const assetsDir = resolve('./node_modules/@vue/repl/dist/assets')
            const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
                const url: string = req.url ?? ''
                if (!url.startsWith('/_nuxt/assets/')) return next()
                const filename = url.slice('/_nuxt/assets/'.length).split('?')[0]!
                const filePath = join(assetsDir, filename)
                if (filename && existsSync(filePath)) {
                    res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
                    res.setHeader('Cache-Control', 'no-cache')
                    res.end(readFileSync(filePath, 'utf-8'))
                    return
                }
                next()
            }
            // Prepend so we run BEFORE Vite's transform middleware which otherwise
            // handles /_nuxt/assets/* first and returns before we get a chance to.
            server.middlewares.stack.unshift({route: '', handle: handler})
        },
    },

    vite: {
        server: {
            // Development runs on play.localhost so the cookie boundary matches production
            // (cookies ignore the port, so four ports on bare localhost would share them).
            // Vite rejects unrecognised Host headers since the host-header CVE, and would
            // answer "Blocked request. This host is not allowed." without this.
            allowedHosts: ['.localhost'],
        },
        optimizeDeps: {
            // Both, now that one dev server serves all three modes.
            include: ['@vue/compiler-sfc', 'monaco-editor'],
        },
        // just-bash (via almostnode) imports `{ gunzipSync, gzipSync } from "node:zlib"` for its
        // gzip/rg commands. Those paths are dead code for us, but Rollup still can't resolve
        // gunzipSync against Vite's __vite-browser-external stub and aborts the build. Fix: rewrite
        // the node:zlib import to inline (throwing) stubs before Vite resolves the module.
        // The transform self-gates on `just-bash`/`node:zlib` so it is a no-op when it is not in
        // the graph. Still required as of just-bash 2.14.5 — recheck if it stops importing node:zlib.
        plugins: [{
            // almostnode builds its runtime worker as
            //   new Worker(new URL(/* @vite-ignore */ "/assets/runtime-worker-<hash>.js", import.meta.url))
            // Vite's `vite:worker-import-meta-url` plugin treats that shape as a worker ENTRY
            // and tries to resolve the file at build time. The @vite-ignore comment does not
            // save it — that plugin does not honour it — so the build dies with
            //   Could not resolve entry module "../../../../../../../../assets/runtime-worker-*.js"
            // as it walks out of the app root looking for a root-absolute path.
            //
            // This only started failing when the app moved into apps/playground: the URL is
            // root-absolute, and the number of `..` segments Vite computes depends on how deep
            // the importer sits, so the shorter old path happened to resolve.
            //
            // The file genuinely is served from the web root (tools/copy-almostnode-assets.mjs
            // puts it in public/), so the right answer is for Vite not to touch it. Rewriting the
            // `new URL(...)` to the bare string leaves `new Worker("/assets/…")`, which resolves
            // against the document at run time — the same URL, minus the build-time resolution.
            //
            // Recheck if almostnode stops hardcoding a web-root worker path.
            name: 'almostnode-worker-url',
            enforce: 'pre' as const,
            transform(code: string, id: string) {
                if (!id.includes('almostnode')) return null
                if (!code.includes('runtime-worker-')) return null
                return code.replace(
                    /new URL\(\s*(?:\/\*[^*]*\*\/\s*)?(["'])(\/assets\/runtime-worker-[^"']+)\1\s*,\s*import\.meta\.url\s*\)/g,
                    (_match: string, _quote: string, path: string) => JSON.stringify(path),
                )
            },
        }, {
            name: 'just-bash-zlib-stub',
            enforce: 'pre' as const,
            transform(code: string, id: string) {
                if (!id.includes('just-bash')) return null
                if (!code.includes('node:zlib')) return null
                return code.replace(
                    /import\s*\{([^}]+)\}\s*from\s*["']node:zlib["']/g,
                    (_: string, imports: string) => imports.split(',').map((spec: string) => {
                        const parts = spec.trim().split(/\s+as\s+/)
                        const orig = parts[0]!.trim()
                        const name = (parts[1] || parts[0]!).trim()
                        if (orig === 'constants') return `const ${name}={Z_BEST_COMPRESSION:9,Z_BEST_SPEED:1,Z_DEFAULT_COMPRESSION:-1}`
                        return `const ${name}=()=>{throw new Error('${orig} not available in browser')}`
                    }).join(';')
                )
            },
        }],
    }
})
