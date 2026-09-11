<script setup lang="ts">
const props = defineProps<{
  files: string[]
  placeholder?: string
}>()

const activeFile = defineModel<string>('activeFile', {required: true})

const emit = defineEmits<{
  delete: [name: string]
  add: [name: string]
}>()

const fileTree = computed(() => buildFileTree(props.files))

const newFileName = ref('')
const addFile = () => {
  if (!newFileName.value) return
  emit('add', newFileName.value)
  newFileName.value = ''
}

const showPlaySubmit = ref(false)
const submitKey = ref(useRoute().query.key?.toString())
onMounted(() => {
  showPlaySubmit.value = 'key' in useRoute().query
})
</script>

<template>
  <aside class="sidebar">
    <h2 class="sidebar-header">Files</h2>
    <div class="file-list">
      <FileTree
          :nodes="fileTree"
          :active-file="activeFile"
          @select="activeFile = $event"
          @delete="emit('delete', $event)"
      />
    </div>
    <form class="file-add" @submit.prevent="addFile">
      <label for="addFile" class="label">Add File</label>
      <div class="flex g-1">
        <input
            id="addFile"
            v-model="newFileName"
            class="input"
            :placeholder="placeholder ?? 'client/src/styles.css'"
            type="text"
        >
        <button type="submit" class="add-file-btn" title="Add file">+</button>
      </div>
    </form>
    <div v-if="showPlaySubmit" class="sidebar-accent">
      <h2 class="sidebar-header">Submit</h2>
      <PlaySubmit class="playSubmit" :exam-key="submitKey"/>
    </div>

    <NuxtLink class="about mt-auto" :to="{name: 'about'}">About</NuxtLink>

  </aside>
</template>

<style scoped>
.sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--mantle);

  & .sidebar-header {
    padding-block: var(--space-2);
    padding-inline: var(--space-3);
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--subtext0);
    border-block-end: 1px solid var(--surface0);
  }

  & .file-list {
    overflow-y: auto;
    margin-block: var(--space-4);
  }

  & .sidebar-accent {
    border-block: 2px solid var(--red);
    color: var(--text);
    margin-block-start: var(--space-4);
    padding-block: var(--space-4);
    overflow: auto;
    max-height: 40%;

    h2 {
      color: var(--red);
    }
  }
}

.about {
  background: var(--surface0);
  color: var(--text);
  text-align: center;
  display: block;
  text-decoration: none;
  font-variant: all-petite-caps;
  padding: var(--space-2);

  &:hover, &:focus-visible {
    color: var(--blue)
  }
}

</style>
