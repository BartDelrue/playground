export default defineEventHandler(async event => {
    await requireAdmin(event)
    const {label} = await readBody<{ label?: unknown }>(event)

    const text = String(label ?? '').trim()
    if (!text) throw createError({statusCode: 400, statusMessage: 'A test needs a name'})
    if (text.length > 120) throw createError({statusCode: 413, statusMessage: 'That name is too long'})

    // The store derives the identifier and rejects a name with nothing to build one from,
    // so there is no second place that has to know the slug rules.
    return useTestStore().create(text)
})
