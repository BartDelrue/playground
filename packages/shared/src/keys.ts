/**
 * Exam keys and the storage keys derived from them.
 */

/** Exam keys are 6 lowercase hex characters, as generated below. */
const EXAM_KEY_RE = /^[0-9a-f]{6}$/

export function isValidExamKey(key: unknown): key is string {
  return typeof key === 'string' && EXAM_KEY_RE.test(key)
}

/**
 * Mint a new exam key. 3 bytes gives 16.7M values, which is ample for telling a class
 * apart but is NOT a secret worth brute-force protection on its own - the submit endpoint
 * rate-limits instead.
 */
export function newExamKey(): string {
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Collapse arbitrary text into something safe to use as a filename or URL segment.
 *
 * Accents are folded to ASCII first, so one name cannot end up under two different
 * filenames depending on whether it arrived NFC- or NFD-normalised - Windows and Linux
 * disagree, and an existence check would then miss the file and silently duplicate it.
 */
export function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * The `<name>.<key>` label a submission is filed under.
 *
 * Historic note worth keeping: this used to be `Object.values(entry).join('.')` followed
 * by `.replace(' ', '_')`. Without the /g flag only the FIRST space was replaced, so any
 * name with two or more spaces leaked a raw space into the filename - 11 of the 31 names
 * in the first cohort were affected. Reading the fields by name also removes a dependency
 * on property order inside the key store, which the admin portal now writes.
 */
export function toStorageKey(name: string, key: string): string {
  return `${slug(name) || 'unknown'}.${slug(key) || 'nokey'}`
}
