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

// A storage key becomes a filename under uploads/ (nitro's fs driver) and is the handle
// the review UI lists a submission by, so it has to be unique per student, stable across
// that student's submissions, and free of anything a filesystem or URL will mangle.
//
// The `<name>.<key>` shape is kept deliberately: the 20 current names that are a plain
// two-word pair keep the exact storage key they already have on disk. What changes:
//
//   - Every run of non-alphanumerics collapses to a single '_'. The previous
//     `.replace(' ', '_')` had no /g, so it only ever replaced the FIRST space and let
//     the rest through into the filename — 11 of the 31 names currently in allowed-keys
//     have two or more spaces ('Joshua Eric Van Keymeulen' landed as
//     'Joshua_Eric Van Keymeulen.<key>').
//   - Accents fold to ASCII, so one student cannot end up under two different filenames
//     depending on whether the name arrived NFC- or NFD-normalised (Windows and Linux
//     disagree, and hasItem() below would then miss the existing file).
function toStorageKey(name: string, key: string): string {
    const safe = (s: string) => s
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')   // drop the marks NFKD just split off
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    return `${safe(name) || 'unknown'}.${safe(key) || 'nokey'}`
}

async function getKeyUser(key: string): Promise<string | undefined> {
    const allowedKeys =
        await useStorage('data')
            .getItem<{ name: string, key: string }[]>('allowed-keys')

    if (!allowedKeys)
        throw createError({statusCode: 500, statusMessage: 'Could not verify allowed keys'})

    const keyUser = allowedKeys.find((entry) => entry.key === key)

    // Read the fields by name rather than Object.values(): the old version depended on
    // the property order inside allowed-keys, which the admin portal is about to become
    // the writer of.
    return keyUser ? toStorageKey(keyUser.name, keyUser.key) : undefined
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