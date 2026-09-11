import { describe, expect, it } from 'vitest'
import { loadPreview } from '../../app/composables/previews/preview'

/**
 * Regression guard for a bug that cost an evening.
 *
 * `loadPreview` must return the preview composable UNCALLED. It used to call it, which
 * meant the composable ran inside an awaited plain function - past the point where
 * `<script setup>`'s withAsyncContext restores the component instance. Vue's lifecycle
 * hooks silently became no-ops, so the `message` listener was never attached, the shim's
 * `ready` went unheard, and the browser preview sat empty on "Starting preview…".
 *
 * Nothing in the type system catches that: both shapes typecheck. What distinguishes them
 * is that one is a function and the other is an object, so that is what this asserts.
 */
describe('loadPreview', () => {
  it.each(['browser', 'node'] as const)('returns an uncalled factory for %s mode', async mode => {
    const factory = await loadPreview(mode)

    expect(typeof factory).toBe('function')
    // One parameter: the files snapshot. An already-invoked composable would be an object.
    expect(factory).toHaveLength(1)
  })

  it('does not invoke the composable while loading', async () => {
    // Calling the composable needs Vue's reactivity and Nuxt's runtime config, neither of
    // which exists here. If loadPreview invoked it, awaiting would throw rather than
    // resolve - so simply resolving is the assertion.
    await expect(loadPreview('browser')).resolves.toBeTypeOf('function')
    await expect(loadPreview('node')).resolves.toBeTypeOf('function')
  })
})
