/**
 * CORS preflight for the submit endpoint.
 *
 * A separate file because Nitro routes by method suffix: submit.post.ts matches POST
 * only, so an OPTIONS request would 405 before any handler ran and the browser would
 * report a misleading CORS failure.
 */
export default defineEventHandler(event => {
    const ok = applyCors(event)
    setResponseStatus(event, ok ? 204 : 403)
    return null
})
