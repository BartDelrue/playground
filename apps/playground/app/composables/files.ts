import type {PlaygroundMode} from '@playground/shared'
import {getLanguage, loadHash, saveHash} from '~/helper'
import {BROWSER_DEFAULT_FILES, VUE_DEFAULT_FILES, NODE_DEFAULT_FILES} from '~/defaults/defaults'

export interface FsProvider {
    fs: {
        mkdir(p: string, opts?: { recursive?: boolean }): Promise<void>
        writeFile(p: string, c: string | Uint8Array): Promise<void>
    }
}

const MODE_DEFAULTS: Record<PlaygroundMode, Record<string, string>> = {
    'browser': BROWSER_DEFAULT_FILES,
    'vue': VUE_DEFAULT_FILES,
    'node': NODE_DEFAULT_FILES,
}

export const useFiles = async (mode: PlaygroundMode, getWc: () => FsProvider | null) => {

    // Read the route BEFORE awaiting: past an await there is no active instance, and a
    // Nuxt composable that needs one is a latent warning at best.
    const queryFile = useRoute().query.file?.toString()
    const initial = await loadHash() ?? {...MODE_DEFAULTS[mode]}

    const files = reactive<Record<string, string>>({...initial})
    const activeFile = ref<string>(queryFile && queryFile in files ? queryFile : Object.keys(files)[0] || '')
    const activeLang = computed(() => getLanguage(activeFile.value))

    let hashTimer: ReturnType<typeof setTimeout> | null = null
    const wcTimers = new Map<string, ReturnType<typeof setTimeout>>()

    watch(files, () => {
        if (hashTimer) clearTimeout(hashTimer)
        hashTimer = setTimeout(() => saveHash(Object.fromEntries(Object.entries(files))), 300)
    }, {deep: true})

    const newFileName = ref('')

    async function addFile(name: string = toValue(newFileName)): Promise<void> {
        if (!name || name in files) return
        files[name] = ''
        activeFile.value = name
    }

    function deleteFile(fp: string): void {
        if (Object.keys(files).length <= 1) return
        Reflect.deleteProperty(files, fp)
        if (activeFile.value === fp) activeFile.value = Object.keys(files)[0] ?? ''
    }

    async function onEditorChange(content: string): Promise<void> {
        const file = activeFile.value
        files[file] = content          // update reactive model immediately
        const wc = getWc()
        if (!wc) return

        const prev = wcTimers.get(file)
        if (prev) clearTimeout(prev)
        wcTimers.set(file, setTimeout(async () => {
            wcTimers.delete(file)
            try {
                const parts = file.split('/')
                if (parts.length > 1)
                    await wc.fs.mkdir(parts.slice(0, -1).join('/'), {recursive: true}).catch(() => {
                    })
                await wc.fs.writeFile(file, files[file] ?? '')
            } catch { /* non-fatal */
            }
        }, 300))
    }

    return {files, activeFile, activeLang, addFile, deleteFile, onEditorChange, newFileName}
}
