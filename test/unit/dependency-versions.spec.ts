import { describe, expect, it } from 'vitest'
import { dependencyVersionsFromImportMap } from '../../app/helper/index'

describe('dependencyVersionsFromImportMap', () => {
  it('pins the versions the vue playground import map ships with', () => {
    expect(dependencyVersionsFromImportMap({
      'vue-router': 'https://esm.sh/vue-router@4',
      'pinia': 'https://esm.sh/pinia@2',
    })).toEqual({ 'vue-router': '4', 'pinia': '2' })
  })

  it('reads versions from unpkg and jsdelivr URLs too', () => {
    expect(dependencyVersionsFromImportMap({
      'pinia': 'https://cdn.jsdelivr.net/npm/pinia@2.3.1/+esm',
      'vue-router': 'https://unpkg.com/vue-router@4.6.4/dist/vue-router.mjs',
    })).toEqual({ 'pinia': '2.3.1', 'vue-router': '4.6.4' })
  })

  it('handles scoped packages', () => {
    expect(dependencyVersionsFromImportMap({
      '@vueuse/core': 'https://esm.sh/@vueuse/core@11.0.0',
    })).toEqual({ '@vueuse/core': '11.0.0' })
  })

  // Falling back to `latest` beats pinning the wrong package's version.
  it('skips entries whose URL package does not match the specifier', () => {
    expect(dependencyVersionsFromImportMap({
      // useVueImportMap maps the `vue` specifier onto @vue/runtime-dom
      'vue': 'https://cdn.jsdelivr.net/npm/@vue/runtime-dom@3.5.35/dist/runtime-dom.esm-browser.js',
      'vue/server-renderer': 'https://cdn.jsdelivr.net/npm/@vue/server-renderer@3.5.35/dist/server-renderer.esm-browser.js',
    })).toEqual({})
  })

  it('ignores unversioned and non-absolute URLs', () => {
    expect(dependencyVersionsFromImportMap({
      'lodash': 'https://esm.sh/lodash',
      'local': './src/local.js',
      'bare': 'not a url',
    })).toEqual({})
  })

  it('tolerates a missing or empty import map', () => {
    expect(dependencyVersionsFromImportMap(undefined)).toEqual({})
    expect(dependencyVersionsFromImportMap({})).toEqual({})
  })
})
