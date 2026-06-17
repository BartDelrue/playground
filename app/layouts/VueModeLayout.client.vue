<script setup lang="ts">
import {Repl, useStore, useVueImportMap, mergeImportMap} from '@vue/repl'
import appVueDefault  from '~/defaults/vue/src/App.vue?raw'
import defaultImports from '~/defaults/vue/importmap.json'
import Monaco from '@vue/repl/monaco-editor'
import '@vue/repl/style.css'
import AppHeader from "~/components/AppHeader.vue";
import SideBar from "~/components/SideBar.vue";
import AppDivider from "~/components/AppDivider.vue";

defineProps<{ displayMode?: DisplayMode }>()

const sideBarPos = ref(200)

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

const visibleFiles = computed(() =>
  Object.entries(store.files)
    .filter(([, f]) => !f.hidden)
    .map(([name]) => name)
)
</script>

<template>
  <div class="app-root">

    <template v-if="displayMode === 'minimal'">
      <main class="workspace">
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
    </template>

    <template v-else-if="displayMode === 'vertical'">
      <main class="workspace">
        <Repl
            :store="store"
            :editor="Monaco"
            theme="dark"
            layout="vertical"
            :show-compile-output="false"
            :show-import-map="false"
            :show-ts-config="false"
            style="flex:1;overflow:hidden;min-width:0; --header-height: 0%"
        />
      </main>
    </template>

    <template v-else>
      <AppHeader title="🟢 Vue Playground" :active-file="store.activeFilename"/>
      <main class="workspace">


        <SideBar
            :active-file="store.activeFilename"
            :style="{ width: sideBarPos + 'px' }"
            :files="visibleFiles"
            placeholder="src/AppComponent.vue"
            @update:active-file="store.setActive($event)"
            @add="store.addFile($event)"
            @delete="store.deleteFile($event)"
        />

        <AppDivider
            v-model="sideBarPos"
            axis="x"
            :min="60"
            :max="420"
        />

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
    </template>

  </div>
</template>

<style>
/* Replace @vue/repl's file tabs with our sidebar */
.vue-repl .file-selector {
  display: none !important;
}
</style>
