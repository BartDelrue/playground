import type { H3Event } from 'h3'

/**
 * CORS for the submit endpoint.
 *
 * Students post from the playground origin, which is not this one, and
 * `Content-Type: application/json` makes it a non-simple request - so there is a
 * preflight to answer. The allow-list comes from config; a request from anywhere else
 * gets no CORS headers at all and the browser refuses it.
 *
 * Credentials are never allowed: the exam key is the only credential this endpoint
 * accepts, and permitting cookies would let a page piggyback on an admin session.
 */
export function allowedOrigins(event: H3Event): string[] {
  return String(useRuntimeConfig(event).allowedOrigins || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
}

/** Echo the origin back when it is on the list. Returns false when it is not. */
export function applyCors(event: H3Event): boolean {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || !allowedOrigins(event).includes(origin)) return false

  setResponseHeaders(event, {
    // Echo the specific origin rather than '*': narrower, and required if this ever
    // needs credentials.
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  })
  return true
}
