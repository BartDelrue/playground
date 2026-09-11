import {isValidTestId} from '@playground/shared'

export default defineEventHandler(async event => {
    await requireAdmin(event)
    const {testId, names} = await readBody<{ testId?: unknown; names?: unknown }>(event)

    if (!isValidTestId(testId)) {
        throw createError({statusCode: 400, statusMessage: 'Pick a test to issue these keys for'})
    }

    // Accepts a paste of a whole class list: newline or comma separated, in one request,
    // because typing thirty names one at a time is how mistakes get made.
    const list = (Array.isArray(names) ? names.map(String) : String(names ?? '').split(/[\n,]/))
        .map(name => name.trim())
        .filter(Boolean)

    if (list.length === 0) throw createError({statusCode: 400, statusMessage: 'No names given'})
    if (list.length > 200) throw createError({statusCode: 413, statusMessage: 'Too many names at once'})

    const store = useKeyStore()
    const created = []
    for (const name of list) created.push(await store.create(testId, name))
    return created
})
