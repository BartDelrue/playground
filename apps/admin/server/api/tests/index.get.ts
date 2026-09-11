export default defineEventHandler(async event => {
    await requireAdmin(event)
    return useTestStore().list()
})
