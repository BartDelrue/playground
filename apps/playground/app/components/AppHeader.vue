<script setup lang="ts">
defineProps<{
  title: string
  activeFile?: string
}>()
</script>

<template>
  <header class="toolbar">
    <h1 class="toolbar-title">{{ title }}</h1>
    <span class="toolbar-file">{{ activeFile }}</span>
    <slot/>
  </header>
</template>

<style scoped>

</style>
