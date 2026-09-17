import { describe, expect, it } from 'vitest'
import { buildHtml, linkTarget, navigationScript } from '../src/bundler'

/**
 * Multi-page work in browser mode: two documents in one snapshot, linked to each other.
 * Nothing serves those paths, so the shim resolves them itself - these pin the rules it
 * resolves by.
 */
const FILES = {
  'index.html': '<html><head></head><body><a href="./projecten/">projecten</a></body></html>',
  'projecten/index.html': '<html><head></head><body><a href="../">home</a></body></html>',
  'projecten/detail.html': '<html><head></head><body></body></html>',
  'styles.css': 'body { color: red }',
}

describe('linkTarget', () => {
  it('gives a directory its index.html', () => {
    expect(linkTarget('index.html', './projecten/', FILES)).toBe('projecten/index.html')
  })

  it('treats a directory named without its trailing slash as one', () => {
    // A real server answers this with a redirect; here it is simply the same page.
    expect(linkTarget('index.html', 'projecten', FILES)).toBe('projecten/index.html')
  })

  it('climbs back out to the root document', () => {
    expect(linkTarget('projecten/index.html', '../', FILES)).toBe('index.html')
    expect(linkTarget('projecten/index.html', '../index.html', FILES)).toBe('index.html')
  })

  it('resolves a sibling against the page it was clicked on, not the root', () => {
    expect(linkTarget('projecten/index.html', 'detail.html', FILES)).toBe('projecten/detail.html')
  })

  it('resolves a root-relative path', () => {
    expect(linkTarget('projecten/index.html', '/index.html', FILES)).toBe('index.html')
  })

  it('drops the query and fragment before looking the file up', () => {
    expect(linkTarget('index.html', './projecten/?sort=naam#top', FILES)).toBe('projecten/index.html')
  })

  it('returns null for a path the snapshot does not contain', () => {
    expect(linkTarget('index.html', './contact/', FILES)).toBeNull()
    expect(linkTarget('index.html', './typo.html', FILES)).toBeNull()
  })
})

describe('navigationScript', () => {
  const script = navigationScript()

  it('cancels the click and posts one hop up', () => {
    expect(script).toContain('e.preventDefault()')
    expect(script).toContain('window.parent.postMessage')
    expect(script).not.toContain('window.top')
  })

  it('leaves fragments, schemes and modified clicks to the browser', () => {
    expect(script).toContain("href.charAt(0) === '#'")
    expect(script).toContain('e.metaKey')
    expect(script).toContain('download')
  })

  it('derives its own target origin rather than taking one on trust', () => {
    expect(script).toContain('location.origin')
    expect(script).not.toMatch(/postMessage\([^)]*,\s*'\*'\s*\)/)
  })
})

describe('buildHtml navigation option', () => {
  it('injects the interceptor into the head when asked', () => {
    const html = buildHtml(FILES['index.html'], 'index.html', FILES, new Map(), { navigation: true })
    expect(html.indexOf('playground-navigate')).toBeGreaterThan(html.indexOf('<head>'))
    expect(html.indexOf('playground-navigate')).toBeLessThan(html.indexOf('</head>'))
  })

  it('leaves it out by default', () => {
    // Node mode serves its own paths through the service worker; intercepting clicks
    // there would break routing that works.
    const html = buildHtml(FILES['index.html'], 'index.html', FILES, new Map())
    expect(html).not.toContain('playground-navigate')
    expect(html).toContain('playground-console')
  })
})
