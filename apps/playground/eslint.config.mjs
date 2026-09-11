// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    // The shared package has no app of its own, so the playground lints it. Kept here
    // rather than in a root config because ESLint flat config does not cascade into
    // subdirectories - a root config would silently lint nothing in either app.
    files: ['../../packages/shared/src/**/*.ts', '../../tools/**/*.mjs'],
  },
)
