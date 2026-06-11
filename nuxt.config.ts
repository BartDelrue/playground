// https://nuxt.com/docs/api/configuration/nuxt-config
import { resolve, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const mode = process.env.VITE_PREVIEW_MODE ?? 'browser'

const META: Record<string, { title: string; favicon: string }> = {
    'browser':   { title: 'Browser Playground',   favicon: '/favicon-browser.svg'   },
    'vue':       { title: 'Vue Playground',        favicon: '/favicon-vue.svg'       },
    'node':      { title: 'Node Playground',       favicon: '/favicon-vite-node.svg' },
}
const { title, favicon } = META[mode]!

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    ssr: false,
    devtools: {enabled: true},
    app: {
        head: {
            title,
            htmlAttrs: { lang: 'en' },
            link: [{ rel: 'icon', type: 'image/svg+xml', href: favicon }],
        },
    },
    modules: ['@nuxt/eslint', '@nuxt/icon', '@nuxt/test-utils'],
    css: ['~/assets/main.css'],
    nitro: {
        output: {dir: 'dist/' + mode },
        storage: {
            data: { driver: 'fs', base: './data' },
            uploads: { driver: 'fs', base: './uploads' }
        }
    },

    // @vue/repl's workers use `"" + new URL("assets/worker.js", import.meta.url).href`
    // — the string concatenation prevents Vite from recognising it as a worker asset,
    // so the files never get copied to the pre-bundled output. Requests land at
    // /_nuxt/assets/*.js with an empty (no MIME type) response.
    //
    // Using vite.plugins would add a Vite plugin which triggers a Vite 7.3.5 bug
    // (EnvironmentPluginContainer.transform infinite recursion). Instead we use
    // Nuxt's hook which adds middleware AFTER the server is created, bypassing the
    // broken plugin initialization path.
    hooks: {
        'vite:serverCreated'(server: any) {
            const assetsDir = resolve('./node_modules/@vue/repl/dist/assets')
            const handler = (req: any, res: any, next: () => void) => {
                const url: string = req.url ?? ''
                if (!url.startsWith('/_nuxt/assets/')) return next()
                const filename = url.slice('/_nuxt/assets/'.length).split('?')[0]
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
            server.middlewares.stack.unshift({ route: '', handle: handler })
        },
    },

    vite: {
        define: {
            'import.meta.env.VITE_PREVIEW_MODE': JSON.stringify(mode),
        },
        optimizeDeps: {
            include: mode === 'vue'
                ? ['@vue/compiler-sfc']
                : ['@webcontainer/api', 'monaco-editor'],
        },
        // just-bash (a dep of almostnode) ships a "browser" bundle that still has
        // `import { gunzipSync } from "node:zlib"` for its gunzip/gzip shell commands.
        // Those paths are dead code in our usage, but Rollup errors when it can't
        // find `gunzipSync` in Vite's __vite-browser-external stub.
        // Fix: rewrite the import to inline stubs before Vite resolves the module.
        plugins: mode === 'node' ? [{
            name: 'just-bash-zlib-stub',
            enforce: 'pre' as const,
            transform(code: string, id: string) {
                if (!id.includes('just-bash')) return null
                if (!code.includes('node:zlib')) return null
                return code.replace(
                    /import\s*\{([^}]+)\}\s*from\s*["']node:zlib["']/g,
                    (_: string, imports: string) => imports.split(',').map((spec: string) => {
                        const parts = spec.trim().split(/\s+as\s+/)
                        const orig = parts[0].trim()
                        const name = (parts[1] || parts[0]).trim()
                        if (orig === 'constants') return `const ${name}={Z_BEST_COMPRESSION:9,Z_BEST_SPEED:1,Z_DEFAULT_COMPRESSION:-1}`
                        return `const ${name}=()=>{throw new Error('${orig} not available in browser')}`
                    }).join(';')
                )
            },
        }] : [],
    }
})
