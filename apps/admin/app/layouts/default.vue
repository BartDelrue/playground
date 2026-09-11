<script setup lang="ts">
const {loggedIn, clear} = useUserSession()

async function signOut() {
  await $fetch('/api/auth/logout', {method: 'POST'})
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <header class="topbar">
      <h1>Playground admin</h1>
      <nav v-if="loggedIn">
        <NuxtLink to="/" active-class="active">Submissions</NuxtLink>
        <NuxtLink to="/keys" active-class="active">Exam keys</NuxtLink>
        <button class="btn" type="button" @click="signOut">Sign out</button>
      </nav>
    </header>
    <main>
      <slot/>
    </main>
  </div>
</template>
