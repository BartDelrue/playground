/**
 * Everything except the login page requires a session. Global middleware rather than
 * per-page so a new page cannot be added unprotected by omission.
 *
 * This is a redirect for the humans; the actual enforcement is requireAdmin() on every
 * endpoint, because route middleware is only ever a convenience.
 */
export default defineNuxtRouteMiddleware(to => {
    const {loggedIn} = useUserSession()
    if (to.path === '/login') {
        return loggedIn.value ? navigateTo('/') : undefined
    }
    if (!loggedIn.value) return navigateTo('/login')
})
