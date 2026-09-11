import {isValidTestId} from '@playground/shared'

export default defineEventHandler(async event => {
    await requireAdmin(event)
    const {testId, examKey} = getQuery<{ testId?: string; examKey?: string }>(event)

    if (testId !== undefined && !isValidTestId(testId)) {
        throw createError({statusCode: 400, statusMessage: 'Not a test identifier'})
    }

    return useSubmissionStore().list({testId, examKey})
})
