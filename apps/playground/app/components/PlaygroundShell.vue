<script setup lang="ts">
import type {Component} from 'vue'
import type {PlaygroundMode} from '@playground/shared'

const props = defineProps<{ mode: PlaygroundMode }>()

// One build serves all three modes now, so identity is set per route instead of per build.
const META: Record<PlaygroundMode, { title: string; favicon: string }> = {
  browser: {title: 'Browser Playground', favicon: '/favicon-browser.svg'},
  vue: {title: 'Vue Playground', favicon: '/favicon-vue.svg'},
  node: {title: 'Node Playground', favicon: '/favicon-vite-node.svg'},
}

useHead({
  title: META[props.mode].title,
  link: [{rel: 'icon', type: 'image/svg+xml', href: META[props.mode].favicon}],
})

// import.meta.client is a compile-time constant, so the prerender pass dead-code
// eliminates these imports and never pulls @vue/repl into its module graph.
//
// Typed through one alias because the ternary otherwise yields a union of two distinct
// module namespaces, which defineAsyncComponent will not accept.
type LayoutLoader = () => Promise<Component | {default: Component}>

const loadLayout: LayoutLoader = import.meta.client
    ? () => props.mode === 'vue'
        ? import('~/views/VueModeView.client.vue')
        : import('~/views/PlaygroundView.vue')
    : () => Promise.resolve({default: {render: () => null}})

const Layout = defineAsyncComponent(loadLayout)

const query = useRoute().query
const displayMode: DisplayMode | undefined = (query.displaymode || query.displayMode) as DisplayMode | undefined
</script>

<template>
  <component :is="Layout" :mode="mode" :display-mode="displayMode"/>
</template>
