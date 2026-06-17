<script setup lang="ts">

const TITLES: Record<string, string> = {
  'browser': '🌐 Browser Playground',
  'node': '📦 Node Playground',
}
const appTitle = TITLES[import.meta.env.VITE_PREVIEW_MODE] ?? '⚡ Playground'
const hasTerminal = ['node'].includes(import.meta.env.VITE_PREVIEW_MODE)

import {usePaneResize} from '~/composables/resize'
import {usePreview} from '~/composables/previews/preview'
import {useLogs} from '~/composables/log'
import {useFiles} from '~/composables/files'

const {sizes, activeDivider, startDrag} = usePaneResize([
  {id: 'sidebar', initial: 200, min: 120, max: 320, axis: 'x', direction: 1},
  {id: 'preview', initial: 420, min: 150, max: 1900, axis: 'x', direction: -1},
  {id: 'terminal', initial: 90, min: 40, max: 600, axis: 'y', direction: -1},
  {id: 'console', initial: 90, min: 40, max: 600, axis: 'y', direction: -1},
])

const {logs, pushLog, clearLog} = useLogs('terminalEl')
const {logs: consoleLogs, clearLog: clearConsole} = useConsole('consoleEl')
const {files, activeFile, activeLang, newFileName, addFile, deleteFile, onEditorChange, fsTree} =
    await useFiles(() => wc.value)
const {isBooting, bootStatus, previewUrl, previewKey, wc, onLog, boot, restart} =
    await usePreview(files, fsTree)

onLog(pushLog)
onMounted(boot)

const showPlaySubmit = ref(false)
onMounted(() => showPlaySubmit.value = 'key' in useRoute().query)

watch(isBooting, v => {
  if (v) {
    clearLog();
    clearConsole()
  }
})

const fileTree = computed(() => buildFileTree(Object.keys(files)))
</script>

<template>
  <div class="app-root">

    <header class="toolbar">
      <h1 class="toolbar-title">{{ appTitle }}</h1>
      <span class="toolbar-file">{{ activeFile }}</span>
      <button class="restart-btn" :disabled="isBooting" @click="restart">
        {{ isBooting ? '…' : '↺ Restart' }}
      </button>
      <span v-if="bootStatus" class="toolbar-status">{{ bootStatus }}</span>
    </header>

    <main class="workspace">

      <aside class="sidebar" :style="{ width: sizes.sidebar + 'px' }">
        <h2 class="sidebar-header">Files</h2>
        <div class="file-list">
          <FileTree
              :nodes="fileTree"
              :active-file="activeFile"
              @select="activeFile = $event"
              @delete="deleteFile($event)"
          />
        </div>
        <form class="file-add" @submit.prevent="addFile">
          <label for="addFile" class="label">Add File</label>
          <div class="flex g-1">
            <input
                id="addFile"
                class="input"
                v-model="newFileName"
                :placeholder="'client/src/styles.css'"
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

      <div class="center-col">
        <section class="editor-pane">
          <MonacoEditor
              :filename="activeFile"
              :model-value="files[activeFile] ?? ''"
              :language="activeLang"
              :all-files="files"
              style="width:100%;height:100%;"
              @update:model-value="onEditorChange"
          />
        </section>

        <div
            class="h-divider" :class="{ active: activeDivider === 'console' }"
            @mousedown.prevent="startDrag($event, 'console')"/>

        <section class="terminal-pane" :style="{ height: sizes.console + 'px' }">
          <div class="pane-header">
            <span>Console</span>
            <button
                @click="clearConsole"
                title="clear" class="del-btn">
              <Icon name="lucide:trash-2"></Icon>
            </button>
          </div>
          <div ref="consoleEl" class="terminal-body">
            <div
                v-for="(line, i) in consoleLogs" :key="i"
                class="log-line" :class="'log-' + line.type"
            >{{ line.text }}
            </div>
          </div>
        </section>

        <div
            v-if="hasTerminal"
            class="h-divider" :class="{ active: activeDivider === 'terminal' }"
            @mousedown.prevent="startDrag($event, 'terminal')"/>

        <section
            v-if="hasTerminal"
            class="terminal-pane" :style="{ height: sizes.terminal + 'px' }">
          <div class="pane-header">terminal</div>
          <div ref="terminalEl" class="terminal-body">
            <div
                v-for="(line, i) in logs" :key="i"
                class="log-line" :class="'log-' + line.type"
            >{{ line.text }}
            </div>
          </div>
        </section>
      </div>

      <div
          class="v-divider" :class="{ active: activeDivider === 'preview' }"
          @mousedown.prevent="startDrag($event, 'preview')"/>

      <aside class="preview-pane" :style="{ width: sizes.preview + 'px' }">
        <div class="pane-header">
          Preview
          <span v-if="previewUrl" class="preview-url">{{ previewUrl }}</span>
        </div>
        <div class="preview-body">
          <iframe
              v-if="previewUrl"
              :key="previewKey"
              :src="previewUrl"
              :title="activeFile + ' preview'"
              class="preview-iframe"
              :style="activeDivider ? 'pointer-events:none' : ''"
          />
          <div v-else class="preview-placeholder">
            <span class="placeholder-icon">🚀</span>
            <span>{{ isBooting ? bootStatus : 'Waiting for server…' }}</span>
          </div>
        </div>
      </aside>

    </main>
  </div>
</template>

<style scoped>

</style>
