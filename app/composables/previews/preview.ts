import type {FileSystemTree} from '@webcontainer/api'

export async function usePreview(files: Record<string, string>, fsTree: () => FileSystemTree) {
    const mode = import.meta.env.VITE_PREVIEW_MODE

    if (mode === 'browser') {
        const {useHtmlPreview} = await import('~/composables/previews/htmlPreview')
        return useHtmlPreview(files)
    }

    if (mode === 'vue') {
        const {useVuePreview} = await import('~/composables/previews/vuePreview')
        return useVuePreview(files)
    }

    const {useAlmostNode} = await import('~/composables/previews/almostnodePreview')
    return useAlmostNode(files)

}
