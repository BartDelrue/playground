<script setup lang="ts">
import {Repl, useStore, useVueImportMap, mergeImportMap} from '@vue/repl'
import appVueDefault  from '~/defaults/vue/src/App.vue?raw'
import defaultImports from '~/defaults/vue/importmap.json'
import Monaco from '@vue/repl/monaco-editor'
import '@vue/repl/style.css'
import AppHeader from "~/components/AppHeader.vue";
import SideBar from "~/components/SideBar.vue";
import AppDivider from "~/components/AppDivider.vue";
import {dependencyVersionsFromImportMap} from '~/helper'

defineProps<{ displayMode?: DisplayMode }>()

const sideBarPos = ref(200)

const {importMap: vueImportMap, vueVersion} = useVueImportMap()
const builtinImportMap = computed(() => mergeImportMap(vueImportMap.value, defaultImports))
const template  = ref({ welcomeSFC: appVueDefault })

// Tells Volar which version of each import-map dependency to fetch types for, so
// vue-router/pinia resolve to real types instead of `any`. Seeded before useStore
// because the Monaco editor reads it the first time it boots the language service.
const dependencyVersion = ref(dependencyVersionsFromImportMap(builtinImportMap.value.imports))

// The worker loads TypeScript itself from a CDN at `store.typescriptVersion`, which
// defaults to the floating `latest`. Pin it: TS 7 dropped the `lib/typescript.js` the
// worker imports (that path 404s on 7.x), so the day a CDN resolves `latest` to 7 the
// language service stops booting altogether and ALL IntelliSense goes with it. 6.0.3 is
// what play.vuejs.org pins and what `latest` happens to resolve to today.
const typescriptVersion = ref('6.0.3')

// `builtinImportMap` is the real option name — useStore ignores an `importMap` key and
// silently falls back to its own useVueImportMap(), which drops vue-router/pinia from the
// sandbox's import map and replaces the vueVersion ref we passed in.
const store = useStore(
    {builtinImportMap, vueVersion, template, dependencyVersion, typescriptVersion},
    location.hash.slice(1) || undefined,
)

// A shared hash can carry its own import map, so keep type acquisition in step with the
// live one rather than only the defaults. reloadLanguageTools is installed by the Monaco
// editor (and debounced there), hence the optional call — it is absent until it mounts.
watchEffect(() => {
  const next = dependencyVersionsFromImportMap(store.getImportMap().imports)
  if (JSON.stringify(next) === JSON.stringify(dependencyVersion.value)) return
  dependencyVersion.value = next
  store.reloadLanguageTools?.()
})

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
