import type { TestSummary } from '@playground/shared'

/**
 * The list of tests, fetched once and shared by every page that shows the picker.
 *
 * Keyed so Nuxt dedupes the request across components; `refreshTests()` is what a page
 * calls after creating a test or a batch of keys, so the counts in the picker stay true.
 */
export function useTests() {
  return useFetch<TestSummary[]>('/api/tests', { key: 'tests' })
}

export function refreshTests() {
  return refreshNuxtData('tests')
}

/**
 * Which test the portal is currently looking at, held in the URL as `?test=`.
 *
 * The URL rather than a ref, for three reasons: the back button works, a link to "the
 * submissions for the January exam" can be pasted to a colleague, and a reload during an
 * exam does not silently drop you back into a different cohort's list.
 *
 * Falls back to the first test, which the API returns newest-first - during an exam that
 * is almost always the one being run.
 */
export function useSelectedTest(tests: Ref<TestSummary[] | null | undefined>) {
  const route = useRoute()
  const router = useRouter()

  const selectedId = computed<string>({
    get() {
      const requested = typeof route.query.test === 'string' ? route.query.test : ''
      // Only honour an id that exists: a stale link must not leave the page filtering on a
      // test that was never created, showing an empty list with no explanation.
      if (requested && tests.value?.some(test => test.id === requested)) return requested
      return tests.value?.[0]?.id ?? ''
    },
    set(id: string) {
      // replace(), not push(): switching test is changing a view, not a step to go back to.
      void router.replace({ query: { ...route.query, test: id || undefined } })
    },
  })

  const selected = computed<TestSummary | null>(() =>
    tests.value?.find(test => test.id === selectedId.value) ?? null)

  return { selectedId, selected }
}
