<script setup lang="ts">
import {routeForMode, type ExamKey, type PlaygroundMode} from '@playground/shared'

const playgroundOrigin = String(useRuntimeConfig().public.playgroundOrigin || '')

const {data: tests} = await useTests()
const {selectedId, selected} = useSelectedTest(tests)

// Sent as undefined rather than '' when there is no test yet: an empty string is not a
// valid identifier and the API rejects it, which would show an error where the honest
// answer is simply "nothing here yet".
const {data: keys, refresh} = await useFetch<ExamKey[]>('/api/keys', {
  query: {testId: computed(() => selectedId.value || undefined)},
})

const names = ref('')
const busy = ref(false)
const error = ref('')
const created = ref<ExamKey[]>([])

const mode = ref<PlaygroundMode>('node')
const namesId = useId()
const modeId = useId()

async function create() {
  busy.value = true
  error.value = ''
  try {
    created.value = await $fetch<ExamKey[]>('/api/keys', {
      method: 'POST',
      body: {testId: selectedId.value, names: names.value},
    })
    names.value = ''
    await Promise.all([refresh(), refreshTests()])
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage || 'Could not create keys'
  } finally {
    busy.value = false
  }
}

const selectedKeys = ref<ExamKey[]>([])
const selectedBusy = ref(false)

function selectAll() {
  keys.value.forEach(key => selectedKeys.value.push(key))
}

async function revokeSelected() {
  if (!confirm(`Withdraw the keys for selected students? Their past submissions stay in the list.`)) return
  selectedBusy.value = true
  await Promise.allSettled(
      selectedKeys.value.map(
          ({key}) => $fetch(`/api/keys/${key}`, {method: 'DELETE'})
      ))
  selectedKeys.value = []
  selectedBusy.value = false
  await refresh()
}

const copyText = ref('copy selected as SVG')

async function copySelected() {
  try {
    await navigator.clipboard.writeText(selectedKeys.value.map(k => `${k.name},${k.key}`).join('\n'))
    copyText.value = `copied ${selectedKeys.value.length} to clipboard`
    setTimeout(() => {
      copyText.value = `copy selected as SVG`
    }, 2000)
  } catch {
    error.value = 'The browser refused clipboard access; select the link and copy it manually.'

  }

}

// Keys just created belong to the test that was selected at the time; switching tests
// while that list is on screen would attach them to the wrong name.
watch(selectedId, () => {
  created.value = [];
  selectedKeys.value = []
})
</script>

<template>
  <div class="stack" style="max-width: 1000px">
    <TestPicker v-model="selectedId" :tests="tests" label="Edit keys for"/>

    <section class="panel">
      <h2>Create keys</h2>

      <p v-if="!selected" class="muted">
        Pick or create a test first — every key belongs to one.
      </p>

      <form v-else class="stack" @submit.prevent="create">
        <div>
          <label :for="namesId">Names, one per line or comma separated</label>
          <textarea :id="namesId" v-model="names" required/>
        </div>
        <div class="row">
          <button class="btn btn-primary" type="submit" :disabled="busy">
            {{ busy ? 'Creating…' : `Create keys in ${selected.label}` }}
          </button>
        </div>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
      </form>

      <div v-if="created.length" class="stack" style="margin-top: 16px">
        <h3 style="font-size: .9rem; margin: 0">Just created</h3>
        <ul class="reset mono">
          <li v-for="key in created" :key="key.key">{{ key.name }} — {{ key.key }}</li>
        </ul>
      </div>
    </section>

    <section class="panel">
      <div class="row" style="justify-content: space-between; align-items: flex-end; margin-bottom: 12px">
        <h2 style="margin: 0">Keys in {{ selected?.label ?? 'this test' }}</h2>
        <div class="row">
          <div>
            <label :for="modeId">Links open</label>
            <select :id="modeId" v-model="mode">
              <option value="node">Node playground</option>
              <option value="vue">Vue playground</option>
              <option value="browser">Browser playground</option>
            </select>
          </div>
        </div>
        <div class="row">
          <button class="btn" type="button" :disabled="selectedBusy" @click="revokeSelected">withdraw selected</button>
          <button class="btn" type="button" :disabled="selectedBusy" @click="copySelected">{{ copyText }}</button>
        </div>
      </div>

      <p v-if="!keys?.length" class="muted">No keys in this test yet.</p>

      <table v-else>
        <thead>
        <tr>
          <th scope="col" class="narrow">
            <button class="btn" @click="selectAll">Select all</button>
          </th>
          <th scope="col">Name</th>
          <th scope="col">Key</th>
          <th scope="col">Status</th>
        </tr>
        </thead>
        <tbody>
        <tr v-for="key in keys" :key="key.key">
          <td><input v-model="selectedKeys" :value="key" type="checkbox" :aria-label="`${key.name}`"></td>
          <td>{{ key.name }}</td>
          <td><code>{{ key.key }}</code></td>
          <td>
            <span v-if="key.revokedAt" class="revoked">withdrawn</span>
            <span v-else class="muted">active</span>
          </td>
        </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.narrow {
  max-width: 1rem;
}

.row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
}
</style>