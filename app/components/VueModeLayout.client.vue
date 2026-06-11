<script setup lang="ts">
import {Repl, useStore, useVueImportMap, mergeImportMap} from '@vue/repl'
import appVueDefault  from '~/defaults/vue/src/App.vue?raw'
import defaultImports from '~/defaults/vue/importmap.json'
import Monaco from '@vue/repl/monaco-editor'
import '@vue/repl/style.css'
import {usePaneResize} from '~/composables/resize'

const {sizes, activeDivider, startDrag} = usePaneResize([
  {id: 'sidebar', initial: 200, min: 120, max: 320, axis: 'x', direction: 1},
])

const {importMap: vueImportMap, vueVersion} = useVueImportMap()
const importMap = computed(() => mergeImportMap(vueImportMap.value, defaultImports))
const template  = ref({ welcomeSFC: appVueDefault })
const store = useStore({importMap, vueVersion, template}, location.hash.slice(1) || undefined)

// Defer capturing the default so the store's import map has time to settle.
// Gate the watchEffect on a reactive flag so we never write a hash before
// the comparison is ready.
const ready = ref(false)
let defaultSerial: string | null = null

nextTick(() => {
  if (!location.hash) defaultSerial = store.serialize()
  ready.value = true
})

watchEffect(() => {
  if (!ready.value) return
  const current = store.serialize()
  history.replaceState(null, '', defaultSerial !== null && current === defaultSerial
    ? location.pathname
    : current)
})

const fileTree = computed(() =>
  buildFileTree(
    Object.entries(store.files)
      .filter(([, f]) => !f.hidden)
      .map(([name]) => name)
  )
)

const newFileName = ref('')
const addFile = () => {
  if (!newFileName.value) return
  store.addFile(toValue(newFileName))
}

const showPlaySubmit = ref(false)
onMounted(() => showPlaySubmit.value = 'key' in useRoute().query)

</script>

<template>
  <div class="app-root">
    <header class="toolbar">
      <h1 class="toolbar-title">🟢 Vue Playground</h1>
      <span class="toolbar-file">{{ store.activeFilename }}</span>
    </header>

    <main class="workspace">

      <aside class="sidebar" :style="{ width: sizes.sidebar + 'px' }">
        <h2 class="sidebar-header">Files</h2>
        <div class="file-list">
          <FileTree
              :nodes="fileTree"
              :active-file="store.activeFilename"
              @select="store.setActive($event)"
              @delete="store.deleteFile($event)"
          />
        </div>
        <form class="file-add" @submit.prevent="addFile">
          <label for="addFile" class="label">Add File</label>
          <div class="flex g-1">
            <input
                id="addFile"
                class="input"
                v-model="newFileName"
                :placeholder="'src/AppComponent.vue'"
                type="text"
            />
            <button type="submit" class="add-file-btn" title="Add file">+</button>
          </div>
        </form>
        <div class="sidebar-accent" v-if="showPlaySubmit">
          <h2 class="sidebar-header">Submit</h2>
          <PlaySubmit class="playSubmit"/>
        </div>
      </aside>

      <div
          class="v-divider" :class="{ active: activeDivider === 'sidebar' }"
          @mousedown.prevent="startDrag($event, 'sidebar')"/>

      <!-- @vue/repl handles Monaco + Volar IntelliSense + live preview -->
      <Repl
          :store="store"
          :editor="Monaco"
          theme="dark"
          :show-compile-output="false"
          :show-import-map="false"
          :show-ts-config="false"
          style="flex:1;overflow:hidden;min-width:0; --header-height: 0%"

      />

    </main>
  </div>
</template>

<style>
/* Replace @vue/repl's file tabs with our sidebar */
.vue-repl .file-selector {
  display: none !important;
}
</style>
