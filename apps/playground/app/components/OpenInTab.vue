<script setup lang="ts">
import {useOpenInTab} from '~/composables/embed'

/**
 * Escape hatch out of an embed, rendered by the cropped layouts only - the full workspace
 * already is what this opens.
 *
 * It renders nothing at all when the playground is not in a frame, so dropping it into a
 * layout costs nothing in the standalone case.
 */
const {embedded, href, refresh} = useOpenInTab()
</script>

<template>
  <!-- The href is rebuilt on the way down so the tab carries the work as it stands; see
       the composable. pointerdown covers middle-click and ctrl-click too, which a click
       handler would miss. -->
  <a
      v-if="embedded"
      class="open-tab"
      :href="href"
      target="_blank"
      rel="noopener"
      title="Open this playground in a new tab"
      @pointerdown="refresh"
      @focus="refresh"
  >
    <Icon name="lucide:external-link"/>
  </a>
</template>

<style scoped>

</style>
