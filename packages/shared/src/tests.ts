/**
 * Test identifiers.
 *
 * A "test" is one exam or exercise session: the thing a batch of keys is issued for and
 * the thing submissions are filed under. It has a human label the lecturer types ("Webdev
 * examen januari 2027") and an id derived from it, which is what ends up in a path, a
 * query string and a filter.
 *
 * The id is validated everywhere it crosses a boundary, because it is used as a directory
 * name: a value carrying `/` or `..` would climb out of the storage directory.
 */

/**
 * Lowercase alphanumerics and single dashes, starting with an alphanumeric, up to 64
 * characters. Deliberately narrower than a filename needs to be - it also has to read
 * cleanly in a URL and be safe as a SQLite key when the store changes.
 */
const TEST_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/

export function isValidTestId(id: unknown): id is string {
  return typeof id === 'string' && TEST_ID_RE.test(id)
}

/**
 * Turn a label into an id: accents folded to ASCII, everything else collapsed to single
 * dashes.
 *
 * Accents are folded rather than dropped so "Kaï" and "Kai" cannot become two different
 * directories depending on whether the text arrived NFC- or NFD-normalised; Windows and
 * Linux disagree about that, and the resulting duplicate would be invisible until someone
 * wondered where half the keys went.
 *
 * Returns '' when nothing usable survives - the caller decides whether that is an error,
 * because a silent fallback id would file work under a name nobody chose.
 */
export function slugifyTestId(label: string): string {
  return label
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    // A trailing dash can survive the slice above.
    .replace(/-+$/, '')
}

/**
 * The test that pre-existing data is filed under.
 *
 * Everything created before tests existed belongs to one real cohort, so it gets one real
 * group rather than being scattered or hidden. Named explicitly so the migration and the
 * UI cannot drift apart about where that data went.
 */
export const IMPORTED_TEST_ID = 'imported'
export const IMPORTED_TEST_LABEL = 'Imported (before tests existed)'
