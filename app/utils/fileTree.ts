import type { FileNode, DirNode } from '~/components/FileTree.vue'

export function buildFileTree(paths: string[]): Record<string, FileNode | DirNode> {
  const root: Record<string, FileNode | DirNode> = {}
  for (const path of paths) {
    const parts = path.split('/')
    let cur = root as Record<string, unknown>
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] ??= { type: 'dir', children: {} }
      cur = cur[parts[i]].children
    }
    cur[parts.at(-1)!] = { type: 'file', path }
  }
  return root
}
