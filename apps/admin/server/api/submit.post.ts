import { decodeHash, detectMode, isValidExamKey } from '@playground/shared'

/**
 * Student submission endpoint. The only unauthenticated write in the app.
 *
 * Rate limited per IP because the exam key is the sole credential and there are only a
 * few dozen valid ones in circulation - without a limit, an unauthenticated client could
 * enumerate the space at whatever speed the network allows.
 */

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 20
const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic sweep so the map cannot grow without bound in a long-lived process.
    if (attempts.size > 5000) {
      for (const [k, v] of attempts) if (now > v.resetAt) attempts.delete(k)
    }
    return true
  }

  entry.count++
  return entry.count <= MAX_PER_WINDOW
}

export default defineEventHandler(async event => {
  // The preflight is answered by submit.options.ts; this handler only ever sees POST.
  const corsOk = applyCors(event)

  if (!corsOk && getRequestHeader(event, 'origin')) {
    // A browser would have blocked the response anyway; failing loudly makes a
    // misconfigured NUXT_ALLOWED_ORIGINS obvious instead of mysterious.
    throw createError({ statusCode: 403, statusMessage: 'Origin not allowed' })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!rateLimit(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Too many submissions, wait a minute' })
  }

  const body = await readBody<{ key?: unknown; url?: unknown }>(event)

  if (!isValidExamKey(body?.key)) {
    throw createError({ statusCode: 400, statusMessage: 'Key not correct' })
  }
  if (typeof body?.url !== 'string' || !body.url) {
    throw createError({ statusCode: 400, statusMessage: 'Payload not correct' })
  }
  if (body.url.length > 50_000) {
    throw createError({ statusCode: 413, statusMessage: 'Payload too large' })
  }

  let submitted: URL
  try {
    submitted = new URL(body.url)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Url not correct' })
  }
  if (submitted.protocol !== 'http:' && submitted.protocol !== 'https:') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid URL protocol' })
  }

  const examKey = await useKeyStore().find(body.key)
  if (!examKey) {
    throw createError({ statusCode: 400, statusMessage: 'Key not allowed' })
  }
  if (examKey.revokedAt) {
    throw createError({ statusCode: 403, statusMessage: 'This key has been withdrawn' })
  }

  // Derive the mode server-side from the snapshot itself rather than trusting a field in
  // the request, so the review UI always links at the route that can actually open it.
  // A hash that will not decode is still accepted: recording the link matters more than
  // classifying it, and a student must never lose a submission to a codec edge case.
  const files = await decodeHash(submitted.hash)
  const mode = files ? detectMode(files) : 'browser'

  const record = await useSubmissionStore().add({
    // The test comes from the key, never from the request: a student types six characters
    // and the server decides which cohort that belongs to.
    testId: examKey.testId,
    examKey: examKey.key,
    // Denormalised: renaming or revoking the key later must not rewrite history.
    studentName: examKey.name,
    url: body.url,
    mode,
  })

  return {
    message: `Received for ${examKey.name} at ${new Date(record.submittedAt).toLocaleTimeString('nl-BE')}`,
    id: record.id,
  }
})
