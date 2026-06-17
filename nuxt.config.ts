// https://nuxt.com/docs/api/configuration/nuxt-config
import {resolve, join} from 'node:path'
import {existsSync, readFileSync} from 'node:fs'

const mode = process.env.VITE_PREVIEW_MODE ?? 'browser'

const META: Record<string, { title: string; favicon: string }> = {
    'browser': {title: 'Browser Playground', favicon: '/favicon-browser.svg'},
    'vue': {title: 'Vue Playground', favicon: '/favicon-vue.svg'},
    'node': {title: 'Node Playground', favicon: '/favicon-vite-node.svg'},
}
const {title, favicon} = META[mode]!

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    ssr: false,
    devtools: {enabled: true},
    app: {
        head: {
            title,
            htmlAttrs: {lang: 'en'},
            link: [{rel: 'icon', type: 'image/svg+xml', href: favicon}],
        },
    },
    modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxt/test-utils'],
    css: ['~/assets/main.css'],
    nitro: {
        output: {dir: 'dist/' + mode},
        storage: {
            data: {driver: 'fs', base: './data'},
            uploads: {driver: 'fs', base: './uploads'}
        }
    },

    // @vue/repl ships its workers as `"" + new URL("assets/…", import.meta.url).href`. The
    // leading `"" +` stops Vite from recognising them as worker assets, so they're never emitted
    // to the pre-bundled output and requests for /_nuxt/assets/*.js return empty / no MIME type.
    // We serve them straight from @vue/repl's dist instead.
    //
    // Deliberately a `vite:serverCreated` hook, not a vite.plugins entry: registering this as a
    // plugin trips a Vite bug (EnvironmentPluginContainer.transform infinite recursion). The hook
    // adds middleware after the server exists, sidestepping that path.
    // Still required as of @vue/repl 4.7.2 + vite 7.3.5 — recheck if either is upgraded.
    hooks: {
        'vite:serverCreated'(server) {
            const assetsDir = resolve('./node_modules/@vue/repl/dist/assets')
            const handler = (req, res, next: () => void) => {
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
        define: {
            'import.meta.env.VITE_PREVIEW_MODE': JSON.stringify(mode),
        },
        optimizeDeps: {
            include: mode === 'vue'
                ? ['@vue/compiler-sfc']
                : ['monaco-editor'],
        },
        // just-bash (via almostnode) imports `{ gunzipSync, gzipSync } from "node:zlib"` for its
        // gzip/rg commands. Those paths are dead code for us, but Rollup still can't resolve
        // gunzipSync against Vite's __vite-browser-external stub and aborts the build. Fix: rewrite
        // the node:zlib import to inline (throwing) stubs before Vite resolves the module.
        // Applies in every mode — just-bash is pulled in across browser/vue/node builds, and the
        // transform self-gates on `just-bash`/`node:zlib` so it's a no-op when it isn't in the graph.
        // Still required as of just-bash 2.14.5 — recheck if it stops importing node:zlib.
        plugins: [{
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
