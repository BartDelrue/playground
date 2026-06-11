export const useConsole = (templateRef: string) => {
    const {logs, pushLog, clearLog} = useLogs(templateRef)

    const handler = (e: MessageEvent) => {
        if (e.data?.source !== 'playground-console') return
        pushLog(String(e.data.message), e.data.type)
    }

    onMounted(() => addEventListener('message', handler))
    onUnmounted(() => removeEventListener('message', handler))

    return {logs, clearLog}
}
