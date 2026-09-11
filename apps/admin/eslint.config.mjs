// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// packages/shared is linted by the playground app's config, not here, so it is not
// checked twice under two rule sets.
export default withNuxt()
