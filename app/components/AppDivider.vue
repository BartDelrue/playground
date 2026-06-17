<script setup lang="ts">
const {axis, min, max, direction = 1, step = 2} = defineProps<{
  axis: 'x' | 'y',
  min: number,
  max: number,
  direction?: 1 | -1,
  step?: number
}>()
const emit = defineEmits<{
  start: [$event: MouseEvent],
  end: [],
  arrow: [direction: 'up' | 'down' | 'left' | 'right']
}>()
const size = defineModel<number>({required: true})

const active = ref(false)

let startPos: number
let startSize: number
const startDrag = (e: MouseEvent) => {
  active.value = true
  emit('start', e)
  startPos = axis === 'x' ? e.clientX : e.clientY
  startSize = size.value
  document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent): void {
  if (!active.value) return

  const current = axis === 'x' ? e.clientX : e.clientY
  const delta = (current - startPos) * direction
  size.value = Math.max(min, Math.min(max, startSize + delta))
}

function move(d: 'up' | 'down' | 'left' | 'right') {
  switch (d) {
    case "left":
    case "down":
      size.value = Math.max(min, Math.min(max, size.value - step ));
      break;
    case "right":
    case "up":
      size.value = Math.max(min, Math.min(max, size.value + step));
      break;
  }
}

function onMouseUp(): void {
  active.value = false
  emit('end')
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

onUnmounted(onMouseUp)
</script>

<template>
  <div
      :class="{ active, 'v-divider': axis === 'x', 'h-divider': axis === 'y'}"
      @mousedown.prevent="startDrag">
    <button
        class="dividerButton"
        aria-label="resize"
        aria-description="use arrow keys"
        @keydown.left="move('left')"
        @keydown.right="move('right')"
        @keydown.up="move('up')"
        @keydown.down="move('down')"/>
  </div>
</template>

<style scoped>
.v-divider,
.h-divider {
  flex-shrink: 0;
  background: var(--surface0);
  transition: background var(--t-fast);
  display: flex;
  justify-content: center;

  &:hover, &.active, &:has(:focus-visible) {
    background: var(--blue);
  }
}

.v-divider {
  inline-size: var(--divider-size);
  cursor: col-resize;
  flex-direction: column;
}

.h-divider {
  block-size: var(--divider-size);
  cursor: row-resize;
}

.dividerButton {
  opacity: 0;
}
</style>