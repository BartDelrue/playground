<script setup lang="ts">
import type { TestSummary } from '@playground/shared'

/**
 * Chooses the test a page is showing, and creates one when there is none to choose.
 *
 * Creating is folded in here rather than living on its own page because the moment a
 * lecturer needs a new test is the moment they are about to issue keys for it.
 */
// Accepts undefined as well as null: useFetch's data ref is undefined before it settles.
const props = defineProps<{ tests: TestSummary[] | null | undefined; label: string }>()
const selectedId = defineModel<string>({ required: true })

const creating = ref(false)
const newLabel = ref('')
const busy = ref(false)
const error = ref('')

const selectId = useId()
const labelId = useId()

async function create() {
  busy.value = true
  error.value = ''
  try {
    const created = await $fetch<{ id: string }>('/api/tests', {
      method: 'POST',
      body: { label: newLabel.value },
    })
    await refreshTests()
    // Switch straight to it: creating a test is always the first step of working in it.
    selectedId.value = created.id
    newLabel.value = ''
    creating.value = false
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage || 'Could not create that test'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="panel testbar">
    <div class="row testbar-row">
      <div class="grow">
        <label :for="selectId">{{ label }}</label>
        <select :id="selectId" v-model="selectedId" :disabled="!props.tests?.length">
          <option v-for="test in props.tests" :key="test.id" :value="test.id">
            {{ test.label }} ({{ test.keyCount }} keys, {{ test.submissionCount }} submitted)
          </option>
        </select>
      </div>
      <button class="btn" type="button" @click="creating = !creating">
        {{ creating ? 'Cancel' : 'New test' }}
      </button>
    </div>

    <p v-if="!props.tests?.length" class="muted">
      No tests yet. Create one before issuing keys.
    </p>

    <form v-if="creating" class="row testbar-row" style="margin-top: 12px" @submit.prevent="create">
      <div class="grow">
        <label :for="labelId">Name for the new test</label>
        <input :id="labelId" v-model="newLabel" required>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="busy">
        {{ busy ? 'Creating…' : 'Create' }}
      </button>
    </form>

    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </div>
</template>
