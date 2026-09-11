import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

/**
 * The authentication seam.
 *
 * Everything downstream sees only a Principal with an opaque id. Nothing learns whether
 * that id is a username, an OIDC `sub` claim or a WebID URI, which is what keeps the
 * eventual swap to an external identity provider a change to this one file.
 *
 * Worth knowing if Solid-OIDC is the destination: it is not plain OIDC. Identity is a
 * WebID and tokens are DPoP-bound, so a generic OIDC client will not cover it - that is
 * @inrupt/solid-client-authn-node territory. The interface below is deliberately narrow
 * enough to survive either.
 */
export interface Principal {
  id: string
  displayName: string
}

export interface SessionProvider {
  current(event: H3Event): Promise<Principal | null>
  logout(event: H3Event): Promise<void>
}

/** Constant-time compare that does not leak length through an early return. */
function secretsMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) {
    // Still do the work, so a wrong-length guess is not measurably faster than a
    // right-length one.
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

/**
 * Password provider: one credential from the environment, no user table.
 *
 * Honest about its limits - it is right for a single lecturer and wrong the moment a
 * second person needs an account. That is the point at which the provider gets replaced
 * rather than extended.
 */
export const passwordProvider: SessionProvider & {
  login(event: H3Event, password: string): Promise<Principal>
} = {
  async current(event) {
    const session = await getUserSession(event)
    const user = session?.user as Principal | undefined
    return user?.id ? user : null
  },

  async logout(event) {
    await clearUserSession(event)
  },

  async login(event, password) {
    const expected = useRuntimeConfig(event).adminPassword
    if (!expected) {
      // Refuse rather than fall open. An unset password must never mean "any password".
      throw createError({ statusCode: 500, statusMessage: 'NUXT_ADMIN_PASSWORD is not configured' })
    }
    if (!password || !secretsMatch(password, expected)) {
      throw createError({ statusCode: 401, statusMessage: 'Wrong password' })
    }
    const principal: Principal = { id: 'admin', displayName: 'Lecturer' }
    await setUserSession(event, { user: principal })
    return principal
  },
}

export const sessionProvider: SessionProvider = passwordProvider

/** Throw a 401 unless there is a live session. Use at the top of every admin endpoint. */
export async function requireAdmin(event: H3Event): Promise<Principal> {
  const principal = await sessionProvider.current(event)
  if (!principal) throw createError({ statusCode: 401, statusMessage: 'Not signed in' })
  return principal
}
