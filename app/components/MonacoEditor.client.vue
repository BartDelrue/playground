<script setup lang="ts">
import '~/monaco-workers'
import * as monaco from 'monaco-editor'
import {setupMonacoVue} from '~/utils/monaco-vue'
import {getLanguage} from '~/helper'

setupMonacoVue(monaco)

const {filename = '', modelValue = '', language = 'javascript', allFiles} = defineProps<{
  filename: string
  modelValue: string
  language: string
  allFiles?: Record<string, string>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const el = useTemplateRef('el')
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let mute = false

function fileUri(fname: string) {
  return monaco.Uri.parse(`file:///${fname}`)
}

function getOrCreateModel(fname: string, content: string, lang: string) {
  if (!fname) return monaco.editor.createModel(content, lang)
  const uri = fileUri(fname)
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, lang, uri)
}

// Register models for ALL project files so the TypeScript service can resolve
// cross-file imports (e.g. import { foo } from './utils')
watchEffect(() => {
  if (!allFiles) return
  for (const [fname, content] of Object.entries(allFiles)) {
    const uri = fileUri(fname)
    const existing = monaco.editor.getModel(uri)
    if (existing) {
      if (existing.getValue() !== content) existing.setValue(content)
    } else {
      monaco.editor.createModel(content, getLanguage(fname), uri)
    }
  }
})

onMounted(() => nextTick(() => {
  const model = getOrCreateModel(filename, modelValue, language)

  editor = monaco.editor.create(el.value!, {
    model,
    theme: 'vs-dark',
    fontSize: 14,
    tabSize: 2,
    automaticLayout: true,
    minimap: {enabled: false},
    scrollBeyondLastLine: false,
  })

  editor.onDidChangeModelContent(() => {
    if (!mute) emit('update:modelValue', editor!.getValue())
  })
}))

onUnmounted(() => {
  editor?.dispose()
  editor = null
})

// Switch model when the active file changes
watch(() => filename, fname => {
  if (!editor) return
  const model = getOrCreateModel(fname, modelValue, language)
  if (editor.getModel() !== model) editor.setModel(model)
})

// Sync value from parent (e.g. loading from URL hash)
watch(() => modelValue, val => {
  if (editor && editor.getValue() !== val) {
    mute = true
    editor.setValue(val ?? '')
    mute = false
  }
})

// Update language when file type changes
watch(() => language, lang => {
  const m = editor?.getModel()
  if (m) monaco.editor.setModelLanguage(m, lang)
})
</script>

<template>
  <div style="width:100%;height:100%" ref="el"></div>
</template>

<style scoped></style>
