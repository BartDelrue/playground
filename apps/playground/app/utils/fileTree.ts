import type { FileNode, DirNode } from '~/components/FileTree.vue'

export function buildFileTree(paths: string[]): Record<string, FileNode | DirNode> {
  const root: Record<string, FileNode | DirNode> = {}
  for (const path of paths) {
    const parts = path.split('/')
    let cur = root as Record<string, unknown>
    for (const segment of parts.slice(0, -1)) {
      // A later path can name a directory that an earlier one already created as a file;
      // reuse the node only when it actually has children, rather than indexing blindly.
      const existing = cur[segment]
      const dir = (existing && typeof existing === 'object' && 'children' in existing)
        ? existing as { children: Record<string, unknown> }
        : { type: 'dir', children: {} as Record<string, unknown> }
      cur[segment] = dir
      cur = dir.children
    }
    cur[parts.at(-1)!] = { type: 'file', path }
  }
  return root
}
