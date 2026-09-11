<script setup lang="ts">
defineOptions({ name: 'FileTree' })

export interface FileNode { type: 'file'; path: string }
export interface DirNode  { type: 'dir';  children: Record<string, FileNode | DirNode> }

const { nodes, activeFile } = defineProps<{
  nodes: Record<string, FileNode | DirNode>
  activeFile: string
}>()

defineEmits<{
  select: [path: string]
  delete: [path: string]
}>()

const sorted = computed(() =>
  Object.entries(nodes).sort(([an, a], [bn, b]) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return an.localeCompare(bn)
  })
)
</script>

<template>
  <template v-for="[name, node] in sorted" :key="name">

    <details v-if="node.type === 'dir'" open class="tree-dir">
      <summary class="tree-summary">{{ name }}</summary>
      <div class="tree-children">
        <FileTree
            :nodes="node.children"
            :active-file="activeFile"
            @select="$emit('select', $event)"
            @delete="$emit('delete', $event)"
        />
      </div>
    </details>

    <div v-else class="file-item" :class="{ active: activeFile === node.path }">
      <button
          class="file-btn"
          :aria-current="activeFile === node.path ? 'true' : undefined"
          @click="$emit('select', node.path)"
      >{{ name }}</button>
      <button
          class="del-btn"
          :aria-label="`Delete ${name}`"
          @click.stop="$emit('delete', node.path)"
      >×</button>
    </div>

  </template>
</template>

<style scoped>
.tree-dir { border: none; margin: 0; padding: 0 }
.tree-summary {
  list-style: none;
  cursor: default;
  padding: 3px 8px;
  font-size: 12px;
  color: var(--text-light, #888);
  user-select: none;
}
.tree-summary::before { content: '▸ '; font-size: 10px }
details[open] > .tree-summary::before { content: '▾ ' }
.tree-children { padding-left: 12px }

.file-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-item {
  padding-block: 5px;
  padding-inline: var(--space-3) var(--space-2);
  cursor: pointer;
  font-size: .8rem;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  user-select: none;
  transition: background var(--t-fast);

  &:hover { background: var(--surface0); }
  &.active { background: var(--surface1); color: var(--blue); }

  & .del-btn {
    visibility: hidden;
    &:focus-visible { visibility: visible; }
  }
  &:hover .del-btn { visibility: visible; }
}
</style>
