<script setup lang="ts">
const isVueMode = import.meta.env.VITE_PREVIEW_MODE === 'vue'

// import.meta.client is a Nuxt/Vite compile-time constant (true on client, false
// on server). When false, Rollup dead-code-eliminates the import() calls, so
// @vue/repl is never analysed in the server module graph.
const Layout = defineAsyncComponent(
    import.meta.client
        ? () => isVueMode
            ? import('~/layouts/VueModeLayout.client.vue')
            : import('~/layouts/PlaygroundLayout.vue')
        : () => Promise.resolve({default: {render: () => null}})
)

const query = useRoute().query
const displayMode: DisplayMode | undefined = (query.displaymode || query.displayMode) as DisplayMode | undefined
</script>

<template>
  <component :is="Layout" :display-mode/>
</template>
