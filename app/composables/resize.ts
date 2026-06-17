export interface PaneConfig<T extends string = string> {
  id: T
  initial: number
  min: number
  max: number
  axis: 'x' | 'y'
  direction?: 1 | -1
}

interface DragState {
  id: string
  startMouse: number
  startSize: number
  axis: 'x' | 'y'
  direction: 1 | -1
  min: number
  max: number
}

export function usePaneResize<T extends string>(configs: PaneConfig<T>[]) {
  const refs = Object.fromEntries(
    configs.map(c => [c.id, ref(c.initial)])
  ) as { [K in T]: Ref<number> }

  const sizes = reactive(refs) as { [K in T]: number }
  const activeDivider = ref<T | null>(null)
  let drag: DragState | null = null

  function startDrag(e: MouseEvent, id: T): void {
    const c = configs.find(cfg => cfg.id === id)!
    drag = {
      id,
      startMouse: c.axis === 'x' ? e.clientX : e.clientY,
      startSize: refs[id].value,
      axis: c.axis,
      direction: c.direction ?? 1,
      min: c.min,
      max: c.max,
    }
    activeDivider.value = id
    document.body.style.cursor = c.axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e: MouseEvent): void {
    if (!drag) return
    const current = drag.axis === 'x' ? e.clientX : e.clientY
    const delta = (current - drag.startMouse) * drag.direction
    refs[drag.id as T].value = Math.max(drag.min, Math.min(drag.max, drag.startSize + delta))
  }

  function onMouseUp(): void {
    drag = null
    activeDivider.value = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  onUnmounted(onMouseUp)

  return {sizes, activeDivider, startDrag}
}
