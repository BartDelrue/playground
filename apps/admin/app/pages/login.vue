<script setup lang="ts">
const password = ref('')
const error = ref('')
const busy = ref(false)
const {fetch: refreshSession} = useUserSession()

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', {method: 'POST', body: {password: password.value}})
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    error.value = (e as { statusMessage?: string }).statusMessage || 'Could not sign in'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="panel" style="max-width: 380px; margin: 8vh auto">
    <h2>Sign in</h2>
    <form class="stack" @submit.prevent="submit">
      <div>
        <label for="pw">Password</label>
        <input id="pw" v-model="password" type="password" autocomplete="current-password" required>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="busy">
        {{ busy ? 'Checking…' : 'Sign in' }}
      </button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>
  </div>
</template>
