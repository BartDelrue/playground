import {isValidExamKey} from '@playground/shared'

export default defineEventHandler(async event => {
    await requireAdmin(event)
    const key = getRouterParam(event, 'key')
    if (!isValidExamKey(key)) throw createError({statusCode: 400, statusMessage: 'Not a key'})

    // Revoke, not delete: submissions made with this key stay attributable.
    await useKeyStore().revoke(key)
    return {ok: true}
})
