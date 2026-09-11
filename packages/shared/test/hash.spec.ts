import { describe, expect, it } from 'vitest'
import { deflateSync } from 'node:zlib'
import { decodeHash, detectMode, encodeHash, routeForMode } from '../src/hash'
import { slug, toStorageKey } from '../src/keys'

/** The zlib + standard-base64 form @vue/repl produces, built without our encoder. */
function zlibHash(files: Record<string, string>): string {
  return deflateSync(Buffer.from(JSON.stringify(files), 'utf8'), { level: 9 }).toString('base64')
}

const SAMPLE = {
  'server/server.js': "import express from 'express'\n",
  'client/index.html': '<h1>Boodschappen</h1>',
  'package.json': '{"type":"module"}',
}

describe('hash codec', () => {
  it('round-trips its own format', async () => {
    expect(await decodeHash(await encodeHash(SAMPLE))).toEqual(SAMPLE)
  })

  it('reads the zlib form @vue/repl writes', async () => {
    expect(await decodeHash(zlibHash(SAMPLE))).toEqual(SAMPLE)
  })

  it('accepts a whole URL, a fragment, or a bare hash', async () => {
    const hash = await encodeHash(SAMPLE)
    expect(await decodeHash(`https://play.example/node/?key=ab12#${hash}`)).toEqual(SAMPLE)
    expect(await decodeHash(`#${hash}`)).toEqual(SAMPLE)
    expect(await decodeHash(hash)).toEqual(SAMPLE)
  })

  it('preserves non-ASCII content', async () => {
    const files = { 'a.js': '// ç é ∑ € 日本語' }
    expect(await decodeHash(await encodeHash(files))).toEqual(files)
  })

  it('survives unpadded standard base64', async () => {
    expect(await decodeHash(zlibHash(SAMPLE).replace(/=+$/, ''))).toEqual(SAMPLE)
  })

  it.each([
    ['empty', ''],
    ['not base64', 'not-a-real-hash!!!'],
    ['base64 but not compressed', Buffer.from('hello world').toString('base64')],
  ])('returns null for %s', async (_label, input) => {
    expect(await decodeHash(input)).toBeNull()
  })

  it('rejects a payload that is not a file map', async () => {
    // Inflating can succeed and still yield the wrong shape, so the parse is part of the
    // detection rather than mere validation.
    expect(await decodeHash(zlibHash([1, 2, 3] as unknown as Record<string, string>))).toBeNull()
  })
})

describe('detectMode', () => {
  it.each([
    ['node', { 'package.json': '{}', 'server/index.js': '' }],
    ['node', { 'server/server.js': '' }],
    ['vue', { 'src/App.vue': '', 'index.html': '' }],
    ['vue', { 'import-map.json': '{}' }],
    ['browser', { 'index.html': '', 'main.js': '', 'styles.css': '' }],
  ] as const)('classifies %s', (expected, files) => {
    expect(detectMode(files)).toBe(expected)
  })

  it('routes browser mode at the root', () => {
    expect(routeForMode('browser')).toBe('/')
    expect(routeForMode('vue')).toBe('/vue')
    expect(routeForMode('node')).toBe('/node')
  })
})

describe('toStorageKey', () => {
  it('replaces every run of non-alphanumerics, not just the first', () => {
    // The bug this replaced used .replace(' ', '_') with no /g flag.
    expect(toStorageKey('Joshua Eric Van Keymeulen', 'abc123')).toBe('Joshua_Eric_Van_Keymeulen.abc123')
  })

  it('folds accents so one name cannot occupy two filenames', () => {
    expect(toStorageKey('Kaï Deneubourg', 'abc123')).toBe('Kai_Deneubourg.abc123')
    expect(slug('Zoë  Van  De  Velde')).toBe('Zoe_Van_De_Velde')
  })

  it('leaves a plain two-word name exactly as it was on disk before', () => {
    expect(toStorageKey('Eryk Lewandowski', '4212b6')).toBe('Eryk_Lewandowski.4212b6')
  })

  it('cannot escape its directory', () => {
    expect(toStorageKey('../../etc/passwd', 'abc123')).toBe('etc_passwd.abc123')
  })

  it('never yields an empty segment', () => {
    expect(toStorageKey('', '')).toBe('unknown.nokey')
  })
})
