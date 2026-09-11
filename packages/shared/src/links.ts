import { routeForMode, type PlaygroundMode } from './hash'

/**
 * The two link rules, in one place because both ends have to agree on them.
 */

/**
 * Query parameters that must never travel in a stored or shared playground link.
 *
 *   key          a credential. It is already a field on the submission record, and it has
 *                no business in a URL that gets stored, listed and clicked. It would also
 *                leave the Submit panel open in the review pane.
 *   displaymode  a viewing preference, not content. A student working inside an embedded
 *                minimal frame would otherwise pin the reviewer to that cropped layout.
 *
 * Both spellings of displaymode are handled because the playground accepts both.
 */
const STRIPPED = ['key', 'displaymode', 'displayMode']

/**
 * What a student submits: their own URL, minus the parameters above.
 *
 * The playground's own URL is the only one carrying the #hash, and the hash is the work.
 * Anything else - notably a wrapper page's URL when the playground is embedded - records a
 * link containing none of the student's code.
 */
export function canonicalSubmitUrl(href: string): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return href // not parseable; better to record it verbatim than to lose it
  }
  for (const param of STRIPPED) url.searchParams.delete(param)
  return url.href
}

/**
 * What the portal opens: the same work, on an origin we control.
 *
 * The route comes from `mode`, which the server derived from the snapshot's own file names
 * rather than from anything the client sent. Only the fragment and the remaining query are
 * taken from the submitted URL, so a link minted on a retired host still opens, and nothing
 * a student submits can decide where the portal navigates.
 */
export function reviewUrl(
  playgroundOrigin: string,
  submission: { url: string; mode: PlaygroundMode },
  displayMode: string | null = 'minimal',
): string {
  // Without a configured origin there is nothing to rebuild against; the raw link is a
  // better answer than a thrown error in a review UI.
  if (!playgroundOrigin) return submission.url

  const route = routeForMode(submission.mode)
  const target = new URL(route === '/' ? '/' : `${route}/`, playgroundOrigin)

  try {
    const submitted = new URL(submission.url)
    // Carry the student's own view forward - which file they had open - minus anything
    // that must not travel.
    for (const [key, value] of submitted.searchParams) {
      if (!STRIPPED.includes(key)) target.searchParams.set(key, value)
    }
    target.hash = submitted.hash
  } catch { /* unreadable link: open an empty playground of the right mode */ }

  if (displayMode) target.searchParams.set('displaymode', displayMode)
  return target.href
}
