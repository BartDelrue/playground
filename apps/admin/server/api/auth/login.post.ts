export default defineEventHandler(async event => {
    const {password} = await readBody<{ password?: string }>(event)
    const principal = await passwordProvider.login(event, String(password ?? ''))
    return {user: principal}
})
