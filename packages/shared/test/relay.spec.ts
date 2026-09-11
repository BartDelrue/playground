import { describe, expect, it } from 'vitest'
import { buildHtml, consoleRelayScript } from '../src/bundler'

/**
 * The relay is injected source, so nothing typechecks it. These assert the two properties
 * the console pane depends on.
 */
describe('consoleRelayScript', () => {
  const script = consoleRelayScript()

  it('posts to window.parent, one hop', () => {
    expect(script).toContain('window.parent.postMessage')
  })

  it('never posts to window.top', () => {
    // The original bug. `top` is the outermost frame, which is the playground only while
    // the playground is not itself embedded - inside the review pane or a course page it
    // becomes the wrapper, so every console pane goes silent and, with more than one
    // playground on the page, the streams arrive mixed together.
    expect(script).not.toContain('window.top')
  })

  it('derives its own target origin rather than taking one on trust', () => {
    expect(script).toContain('location.origin')
    // A bare wildcard would let any page that framed a preview read a student's output.
    expect(script).not.toMatch(/postMessage\([^)]*,\s*'\*'\s*\)/)
  })

  it('is injected into the document head', () => {
    const html = buildHtml(
      '<html><head><title>x</title></head><body></body></html>',
      'index.html',
      {},
      new Map(),
    )
    expect(html.indexOf('playground-console')).toBeGreaterThan(html.indexOf('<head>'))
    expect(html.indexOf('playground-console')).toBeLessThan(html.indexOf('</head>'))
  })
})
