/**
 * "Open in a new tab", for a playground running inside someone else's page.
 *
 * An embedded playground is cropped on purpose - minimal and vertical drop the toolbar
 * and the sidebar - so there is no route from inside the frame to the full workspace, and
 * with `?key=` there is no route to the Submit panel either, since that lives in the
 * sidebar. This hands one back.
 */
export function useOpenInTab() {
  const embedded = ref(false)
  const href = ref('')

  /**
   * The URL is rebuilt on every click rather than once on mount, because the work lives
   * in the fragment and saveHash() rewrites it with replaceState after every edit. Read
   * once at mount, this link would forever open the snapshot the student started with.
   *
   * It trails the editor by saveHash's debounce, which a click seconds after typing never
   * notices. Closing that gap means awaiting an async encode inside the handler, which is
   * how a user gesture gets lost.
   */
  const refresh = (): void => {
    const url = new URL(location.href)
    // A viewing preference, not content: the new tab gets the full workspace. Both
    // spellings, because the playground accepts both (see links.ts).
    url.searchParams.delete('displaymode')
    url.searchParams.delete('displayMode')
    // `key` deliberately stays. It is what opens the Submit panel, and a student working
    // inside an exam embed has nowhere else to submit from.
    href.value = url.href
  }

  onMounted(() => {
    // Comparing the two window objects is allowed cross-origin; reading anything off
    // `top` is not. Client-only: there is no window during the prerender pass.
    embedded.value = window.self !== window.top
    refresh()
  })

  return { embedded, href, refresh }
}
