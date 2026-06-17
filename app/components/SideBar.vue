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
        />
        <button type="submit" class="add-file-btn" title="Add file">+</button>
      </div>
    </form>
    <div v-if="showPlaySubmit" class="sidebar-accent">
      <h2 class="sidebar-header">Submit</h2>
      <PlaySubmit class="playSubmit" :examKey="submitKey"/>
    </div>
  </aside>
</template>

<style scoped>

</style>
