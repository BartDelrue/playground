import {isConsoleMessage} from '@playground/shared'

/**
 * Console pane. Collects the lines relayed out of previewed documents.
 *
 * Browser-mode previews now run on the preview origin, so the sender is checked: a
 * message is accepted only from our own origin (node and vue previews) or from the
 * configured preview origin. Anything else is dropped, which stops an unrelated framed
 * page from writing into a student's console.
 */
export const useConsole = (templateRef: string) => {
    const {logs, pushLog, clearLog} = useLogs(templateRef)
    const previewOrigin = String(useRuntimeConfig().public.previewOrigin || '')

    const handler = (e: MessageEvent) => {
        const trusted = e.origin === window.location.origin
            || (previewOrigin !== '' && e.origin === previewOrigin)
        if (!trusted) return
        if (!isConsoleMessage(e.data)) return
        pushLog(String(e.data.message), e.data.type as LogType)
    }

    onMounted(() => addEventListener('message', handler))
    onUnmounted(() => removeEventListener('message', handler))

    return {logs, clearLog}
}
