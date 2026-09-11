import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'shared',
                    include: ['packages/shared/test/*.{test,spec}.ts'],
                    environment: 'node',
                },
            },
            {
                // The playground's own '~' alias, needed because preview.ts reaches its
                // engines through dynamic imports that survive type erasure.
                resolve: {
                    alias: {
                        '~': fileURLToPath(new URL('./apps/playground/app', import.meta.url)),
                    },
                },
                test: {
                    name: 'playground',
                    include: ['apps/playground/test/unit/*.{test,spec}.ts'],
                    environment: 'node',
                },
            },
        ],
        // Coverage is opt-in via `pnpm test:coverage`. It used to be enabled
        // unconditionally, so every plain test run paid for instrumentation.
        coverage: { provider: 'v8' },
    },
})
