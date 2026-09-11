import type {ShallowRef} from 'vue'
import type {PlaygroundMode} from '@playground/shared'
import type {FsProvider} from '~/composables/files'

/** What every preview engine hands back to the layout. */
export interface PreviewApi {
    onLog: (handler: (text: string, type?: LogType) => void) => void
    wc: ShallowRef<FsProvider | null>
    previewUrl: Ref<string>
    previewKey: Ref<number>
    isBooting: Ref<boolean>
    bootStatus: Ref<string>
    boot: () => void | Promise<void>
    restart: () => void | Promise<void>
}

export type PreviewFactory = (files: Record<string, string>) => PreviewApi

/**
 * Load the preview engine for a mode and return its composable UNCALLED.
 *
 * This deliberately does not invoke it. A composable that registers lifecycle hooks has to
 * run while a component instance is active, and an `await` destroys that: `<script setup>`
 * wraps its own top-level awaits in withAsyncContext and restores the instance afterwards,
 * but code running *inside* an awaited plain function gets no such treatment. Calling
 * useHtmlPreview() from in here meant its onMounted never registered, the message listener
 * was never attached, and the browser preview sat empty on "Starting preview…" forever
 * while the shim's `ready` went unheard.
 *
 * So the layout awaits this to get the factory, then calls the factory synchronously - by
 * which point withAsyncContext has put the instance back. Do not be tempted to inline the
 * call again.
 *
 * Still dynamic imports: this is what keeps almostnode out of the initial chunk, which
 * matters more now that one build serves all three modes.
 *
 * There is no 'vue' branch. Vue mode is rendered by VueModeLayout, which drives @vue/repl's
 * own store and preview - it never calls this.
 */
export async function loadPreview(mode: PlaygroundMode): Promise<PreviewFactory> {
    if (mode === 'browser') {
        const {useHtmlPreview} = await import('~/composables/previews/htmlPreview')
        return useHtmlPreview
    }

    const {useAlmostNode} = await import('~/composables/previews/almostnodePreview')
    return useAlmostNode
}
