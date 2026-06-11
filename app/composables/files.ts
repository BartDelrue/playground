import {type FileSystemTree} from '@webcontainer/api'
import {getLanguage, loadHash, saveHash, toFSTree} from '~/helper'
import {BROWSER_DEFAULT_FILES, VUE_DEFAULT_FILES, VITE_NODE_DEFAULT_FILES, NODE_DEFAULT_FILES} from '~/defaults'

export interface FsProvider {
  fs: {
    mkdir(p: string, opts?: { recursive?: boolean }): Promise<void>
    writeFile(p: string, c: string | Uint8Array): Promise<void>
  }
}

const MODE_DEFAULTS: Record<string, Record<string, string>> = {
  'browser':   BROWSER_DEFAULT_FILES,
  'vue':       VUE_DEFAULT_FILES,
  'node':      NODE_DEFAULT_FILES,
}
const defaults = MODE_DEFAULTS[import.meta.env.VITE_PREVIEW_MODE] ?? VITE_NODE_DEFAULT_FILES

export const useFiles = async (getWc: () => FsProvider | null) => {
  const initial = await loadHash() ?? {...defaults}

  const files      = reactive<Record<string, string>>({...initial})
  const activeFile = ref<string>(Object.keys(files)[0] ?? '')
  const activeLang = computed(() => getLanguage(activeFile.value))

  let hashTimer: ReturnType<typeof setTimeout> | null = null
  const wcTimers = new Map<string, ReturnType<typeof setTimeout>>()

  watch(files, () => {
    if (hashTimer) clearTimeout(hashTimer)
    hashTimer = setTimeout(() => saveHash(Object.fromEntries(Object.entries(files))), 300)
  }, {deep: true})

  const newFileName = ref('')
  async function addFile(): Promise<void> {
    const name = toValue(newFileName)
    if (!name || name in files) return
    files[name] = ''
    activeFile.value = name
  }

  function deleteFile(fp: string): void {
    if (Object.keys(files).length <= 1) return
    delete files[fp]
    if (activeFile.value === fp) activeFile.value = Object.keys(files)[0] ?? ''
  }

  async function onEditorChange(content: string): Promise<void> {
    const file = activeFile.value
    files[file] = content          // update reactive model immediately
    const wc = getWc()
    if (!wc) return

    // Debounce the write per file so Vite HMR fires at most once per pause,
    // not once per keystroke (which accumulates <style> elements in the preview).
    const prev = wcTimers.get(file)
    if (prev) clearTimeout(prev)
    wcTimers.set(file, setTimeout(async () => {
      wcTimers.delete(file)
      try {
        const parts = file.split('/')
        if (parts.length > 1)
          await wc.fs.mkdir(parts.slice(0, -1).join('/'), {recursive: true}).catch(() => {})
        await wc.fs.writeFile(file, files[file] ?? '')
      } catch { /* non-fatal */ }
    }, 300))
  }

  const fsTree = (): FileSystemTree => toFSTree({...files})

  return {files, activeFile, activeLang, addFile, deleteFile, onEditorChange, fsTree, newFileName}
}
