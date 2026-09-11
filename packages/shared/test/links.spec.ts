import { describe, expect, it } from 'vitest'
import { canonicalSubmitUrl, reviewUrl } from '../src/links'

const PLAY = 'https://play.ctrlaltdelrue.be'
const HASH = '#eNqtVk1v9kM'

describe('canonicalSubmitUrl', () => {
  it('keeps the fragment, which is the actual work', () => {
    expect(canonicalSubmitUrl(`${PLAY}/node/${HASH}`)).toBe(`${PLAY}/node/${HASH}`)
  })

  it('drops the exam key so a credential is never stored in a link', () => {
    expect(canonicalSubmitUrl(`${PLAY}/node/?key=a8674a${HASH}`)).toBe(`${PLAY}/node/${HASH}`)
  })

  it('drops displaymode in either spelling', () => {
    expect(canonicalSubmitUrl(`${PLAY}/?displaymode=minimal${HASH}`)).toBe(`${PLAY}/${HASH}`)
    expect(canonicalSubmitUrl(`${PLAY}/?displayMode=vertical${HASH}`)).toBe(`${PLAY}/${HASH}`)
  })

  it('keeps which file was open', () => {
    expect(canonicalSubmitUrl(`${PLAY}/node/?key=a8674a&file=server%2Fserver.js${HASH}`))
      .toBe(`${PLAY}/node/?file=server%2Fserver.js${HASH}`)
  })

  it('records an unparseable link verbatim rather than losing it', () => {
    expect(canonicalSubmitUrl('not a url')).toBe('not a url')
  })
})

describe('reviewUrl', () => {
  it('routes by the server-derived mode, not by the submitted path', () => {
    // A link minted on a retired host, or pointing at the wrong route, still opens.
    expect(reviewUrl(PLAY, { url: `https://old.example/${HASH}`, mode: 'node' }))
      .toBe(`${PLAY}/node/?displaymode=minimal${HASH}`)
    expect(reviewUrl(PLAY, { url: `https://old.example/node/${HASH}`, mode: 'browser' }))
      .toBe(`${PLAY}/?displaymode=minimal${HASH}`)
  })

  it('always lands on the configured origin, whatever was submitted', () => {
    const built = reviewUrl(PLAY, { url: `https://evil.example/x${HASH}`, mode: 'vue' })
    expect(new URL(built).origin).toBe(PLAY)
    expect(built).toBe(`${PLAY}/vue/?displaymode=minimal${HASH}`)
  })

  it('carries the open file across but never the exam key', () => {
    const built = reviewUrl(PLAY, {
      url: `${PLAY}/node/?file=server%2Fserver.js&key=a8674a${HASH}`,
      mode: 'node',
    })
    expect(built).toContain('file=server%2Fserver.js')
    expect(built).not.toContain('key=')
  })

  it('lets the caller ask for the full layout instead', () => {
    expect(reviewUrl(PLAY, { url: `${PLAY}/${HASH}`, mode: 'browser' }, null))
      .toBe(`${PLAY}/${HASH}`)
  })

  it('opens an empty playground of the right mode when the link is unreadable', () => {
    expect(reviewUrl(PLAY, { url: 'not a url', mode: 'vue' }))
      .toBe(`${PLAY}/vue/?displaymode=minimal`)
  })

  it('falls back to the raw link when no origin is configured', () => {
    const raw = `${PLAY}/node/${HASH}`
    expect(reviewUrl('', { url: raw, mode: 'node' })).toBe(raw)
  })
})
