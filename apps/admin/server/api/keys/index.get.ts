import {isValidTestId} from '@playground/shared'

export default defineEventHandler(async event => {
    await requireAdmin(event)
    const {testId} = getQuery<{ testId?: string }>(event)

    // No testId lists every test's keys, which is what the overview wants; a malformed one
    // is a bug in the caller rather than a request for everything.
    if (testId !== undefined && !isValidTestId(testId)) {
        throw createError({statusCode: 400, statusMessage: 'Not a test identifier'})
    }

    return useKeyStore().list(testId ? {testId} : undefined)
})
