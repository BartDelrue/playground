<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <div>
    <h1>Hello from Vue!</h1>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<style>
body { font-family: sans-serif; padding: 2rem; }
button { padding: .5rem 1rem; font-size: 1rem; cursor: pointer; }
</style>
