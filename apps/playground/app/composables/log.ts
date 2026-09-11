export const useLogs = (templateRef: string) => {
    const logs = ref<LogLine[]>([])
    const terminalEl = useTemplateRef<HTMLElement | null>(templateRef)

    function pushLog(text: string, type = LogType.INFO): void {
        text.split('\n').filter(Boolean).forEach(t => logs.value.push({text: t, type}))
        nextTick(() => {
            if (terminalEl.value) terminalEl.value.scrollTop = terminalEl.value.scrollHeight
        })
    }

    const clearLog = () => { logs.value = [] }

    return {logs, pushLog, terminalEl, clearLog}
}
