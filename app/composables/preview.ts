import type {FileSystemTree} from '@webcontainer/api'

export async function usePreview(files: Record<string, string>, fsTree: () => FileSystemTree) {
  const mode = import.meta.env.VITE_PREVIEW_MODE

  if (mode === 'browser') {
    const {useHtmlPreview} = await import('~/composables/htmlPreview')
    return useHtmlPreview(files)
  }

  if (mode === 'vue') {
    const {useVuePreview} = await import('~/composables/vuePreview')
    return useVuePreview(files)
  }

  if (mode === 'node') {
    const {useAlmostNode} = await import('~/composables/almostnode')
    return useAlmostNode(files)
  }

  const {useWebContainer} = await import('~/composables/webContainer')
  return useWebContainer(fsTree)
}
