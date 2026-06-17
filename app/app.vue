<script setup lang="ts">
const isVueMode = import.meta.env.VITE_PREVIEW_MODE === 'vue'

// import.meta.client is a Nuxt/Vite compile-time constant (true on client, false
// on server). When false, Rollup dead-code-eliminates the import() calls, so
// @vue/repl and @webcontainer/api are never analysed in the server module graph.
const Layout = defineAsyncComponent(
    import.meta.client
        ? () => isVueMode
            ? import('~/layouts/VueModeLayout.client.vue')
            : import('~/layouts/PlaygroundLayout.vue')
        : () => Promise.resolve({default: {render: () => null}})
)
</script>

<template>
  <component :is="Layout"/>
</template>
