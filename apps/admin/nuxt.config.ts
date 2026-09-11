// Admin portal: creates exam keys and reviews submissions.
//
// SSR is on here, unlike the playground. This is a data app behind a login, so rendering
// on the server avoids a flash of unauthenticated content and keeps the key list out of a
// client bundle.
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    ssr: true,
    devtools: {enabled: true},

    modules: ['@nuxt/eslint', '@nuxt/icon', 'nuxt-auth-utils'],
    css: ['~/assets/admin.css'],

    // Raw TypeScript with no build step, so Nitro needs it transpiled rather than external.
    build: {transpile: ['@playground/shared']},

    app: {
        head: {
            title: 'Playground admin',
            htmlAttrs: {lang: 'en'},
            meta: [{name: 'robots', content: 'noindex, nofollow'}],
        },
    },

    runtimeConfig: {
        // The single admin credential. One user, so there is no user table - see
        // server/utils/session.ts for the seam that makes OIDC a one-file swap later.
        adminPassword: '',
        // Comma-separated origins allowed to POST a submission. The playground, and
        // nothing else.
        allowedOrigins: '',
        // Where the file stores live. MUST point at a mounted volume in production:
        // container filesystems are ephemeral and a redeploy would erase every submission.
        storageDir: './.data',
        // nuxt-auth-utils reads its settings from runtimeConfig.session, NOT from a
        // top-level `session` key - put them there and they are silently ignored, leaving
        // the module's defaults in place.
        //
        // The cookie is deliberately given no `domain`, which makes it host-only. That is
        // the one rule the whole origin split rests on: a cookie scoped to the parent
        // domain would also be sent to the playground and preview origins, where student
        // code runs, and anything running there could then ride this session. Never add a
        // domain here.
        session: {
            name: 'playground_admin',
            // Supplied by NUXT_SESSION_PASSWORD; the module refuses to start without it.
            password: '',
            cookie: {
                httpOnly: true,
                sameSite: 'lax',
                secure: true,
                path: '/',
            },
        },

        public: {
            // Used to build review links back into the playground.
            playgroundOrigin: '',
        },
    },

    vite: {
        server: {
            // Matches the playground: dev runs on admin.localhost so the cookie boundary
            // behaves as it will in production.
            allowedHosts: ['.localhost'],
        },
    },
})
