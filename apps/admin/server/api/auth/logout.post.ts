export default defineEventHandler(async event => {
    await sessionProvider.logout(event)
    return {ok: true}
})
