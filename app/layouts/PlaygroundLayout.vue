<script setup lang="ts">
import AppHeader from "~/components/AppHeader.vue";
import {usePreview} from '~/composables/previews/preview'
import {useLogs} from '~/composables/log'
import {useFiles} from '~/composables/files'
import SideBar from "~/components/SideBar.vue";
import AppDivider from "~/components/AppDivider.vue";

defineProps<{ displayMode?: DisplayMode }>()

const appTitle = import.meta.env.VITE_PREVIEW_MODE === 'browser' ? '🌐 Browser Playground' : '📦 Node Playground'
const placeholder = import.meta.env.VITE_PREVIEW_MODE === 'browser' ? '' : 'client/src/styles.css'
const hasTerminal = ['node'].includes(import.meta.env.VITE_PREVIEW_MODE)

const dragging = ref(false)
const sideBarPos = ref(200)
const consolePos = ref(90)
const terminalPos = ref(90)
const previewPos = ref(420)

const {logs, pushLog, clearLog} = useLogs('terminalEl')
const {logs: consoleLogs, clearLog: clearConsole} = useConsole('consoleEl')
const {files, activeFile, activeLang, addFile, deleteFile, onEditorChange} =
    await useFiles(() => wc.value)
const {isBooting, bootStatus, previewUrl, previewKey, wc, onLog, boot, restart} =
    await usePreview(files)

onLog(pushLog)
onMounted(boot)

watch(isBooting, v => {
  if (v) {
    clearLog();
    clearConsole()
  }
})
</script>

<template>
  <div class="app-root">
    <template v-if="displayMode === 'minimal'">
      <main class="workspace">
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
        <AppDivider
            v-model="previewPos"
            axis="x"
            :min="150"
            :max="1900"
            :direction="-1"
            @start="dragging = true"
            @end="dragging = false"
        />
        <aside class="preview-pane" :style="{ width: previewPos + 'px' }">
          <div class="preview-body">
            <iframe
                v-if="previewUrl"
                :key="previewKey"
                :src="previewUrl"
                :title="activeFile + ' preview'"
                class="preview-iframe"
                :style="dragging ? 'pointer-events:none' : ''"
            />
            <div v-else class="preview-placeholder">
              <span class="placeholder-icon">🚀</span>
              <span>{{ isBooting ? bootStatus : 'Waiting for server…' }}</span>
            </div>
          </div>

        </aside>
      </main>
    </template>
    <template v-else-if="displayMode === 'vertical'">
      <main class="workspace flex-col">
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
        <AppDivider
            v-model="previewPos"
            axis="y"
            :min="150"
            :max="1900"
            :direction="-1"
            @start="dragging = true"
            @end="dragging = false"
        />
        <aside class="preview-pane" :style="{ height: previewPos + 'px' }">
          <div class="preview-body">
            <iframe
                v-if="previewUrl"
                :key="previewKey"
                :src="previewUrl"
                :title="activeFile + ' preview'"
                class="preview-iframe"
                :style="dragging ? 'pointer-events:none' : ''"
            />
            <div v-else class="preview-placeholder">
              <span class="placeholder-icon">🚀</span>
              <span>{{ isBooting ? bootStatus : 'Waiting for server…' }}</span>
            </div>
          </div>

        </aside>
      </main>
    </template>
    <template v-else>

      <AppHeader :title="appTitle" :active-file="activeFile" v>
        <button class="restart-btn" :disabled="isBooting" @click="restart">
          {{ isBooting ? '…' : '↺ Restart' }}
        </button>
        <span v-if="bootStatus" class="toolbar-status">{{ bootStatus }}</span>
      </AppHeader>

      <main class="workspace">

        <SideBar
            v-model:active-file="activeFile"
            :style="{ width: sideBarPos + 'px' }"
            :files="Object.keys(files)"
            :placeholder
            @add="addFile($event)"
            @delete="deleteFile($event)"
        />

        <AppDivider
            v-model="sideBarPos"
            axis="x"
            :min="60"
            :max="420"
        />

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

          <AppDivider
              v-model="consolePos"
              axis="y"
              :min="40"
              :max="600"
              :direction="-1"
          />

          <section class="terminal-pane" :style="{ height: consolePos + 'px' }">
            <div class="pane-header">
              <span>Console</span>
              <button
                  title="clear"
                  class="del-btn" @click="clearConsole">
                <Icon name="lucide:trash-2"/>
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

          <AppDivider
              v-if="hasTerminal"
              v-model="terminalPos"
              axis="y"
              :min="40"
              :max="600"
              :direction="-1"
          />

          <section
              v-if="hasTerminal"
              class="terminal-pane" :style="{ height: terminalPos + 'px' }">
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

        <AppDivider
            v-model="previewPos"
            axis="x"
            :min="150"
            :max="1900"
            :direction="-1"
            @start="dragging = true"
            @end="dragging = false"
        />

        <aside class="preview-pane" :style="{ width: previewPos + 'px' }">
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
                :style="dragging ? 'pointer-events:none' : ''"
            />
            <div v-else class="preview-placeholder">
              <span class="placeholder-icon">🚀</span>
              <span>{{ isBooting ? bootStatus : 'Waiting for server…' }}</span>
            </div>
          </div>
        </aside>

      </main>

    </template>
  </div>
</template>

<style scoped>

</style>
