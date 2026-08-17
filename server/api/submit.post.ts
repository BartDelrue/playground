async function resolveAvailableUploadTarget(baseKey: string): Promise<string> {
    const storage = useStorage('uploads')
    let index = 0

    while (true) {
        const key = index === 0 ? baseKey : `${baseKey}-${index}`

        if (!await storage.hasItem(key)) {
            return key
        }

        index++
    }
}

async function getKeyUser(key: string) {
    const allowedKeys =
        await useStorage('data')
            .getItem<{ name: string, key: string }[]>('allowed-keys')

    if (!allowedKeys)
        throw createError({statusCode: 500, statusMessage: 'Could not verify allowed keys'})

    const keyUser = allowedKeys.find((entry) => entry.key === key)

    return keyUser ? Object.values(keyUser).join('.').replace(' ', '_') : keyUser
}

export default defineEventHandler({
    handler: async (event) => {

        const {key, url} = await readBody(event)
        const keyUser = await getKeyUser((key))
        if (!keyUser) {
            throw createError({statusCode: 400, statusMessage: 'key not allowed'})
        }

        if (!url || typeof url !== 'string' || !key || typeof key !== 'string')
            throw createError({statusCode: 400, statusMessage: 'Payload not correct'})
        if (url.length > 50000)
            throw createError({statusCode: 413, statusMessage: 'Payload too large'})

        let validatedUrl;
        try {
            validatedUrl = new URL(url)
        } catch {
            throw createError({statusCode: 400, statusMessage: 'Url not correct'})
        }
        if (validatedUrl.protocol !== 'http:' && validatedUrl.protocol !== 'https:')
            throw createError({statusCode: 400, statusMessage: 'Invalid URL protocol'})

        try {
            const resolvedKey = await resolveAvailableUploadTarget(keyUser)
            const storage = useStorage('uploads')
            await storage.setItem(resolvedKey, url)
            return {
                message: `URL saved as: ${resolvedKey}`
            }
        } catch {
            throw createError({statusCode: 500, statusMessage: 'Storage error'})
        }
    }
})