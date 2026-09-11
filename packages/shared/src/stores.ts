/**
 * Storage contracts.
 *
 * Two rules hold this together.
 *
 * Ids are OPAQUE. The original design used the filename as the identity and scanned for a
 * free `name-1`, `name-2` suffix, which was both a check-then-write race and a shape no
 * database would reproduce. Here `add()` mints its own id, so there is nothing to scan and
 * nothing to race, and a SQLite implementation can use the same id as a primary key
 * without changing a caller. Nothing outside the implementations may assume an id is a
 * path.
 *
 * Everything belongs to a TEST. Keys are issued for one test and submissions are filed
 * under it, so a cohort can be listed, exported or archived as a unit rather than
 * filtered out of one ever-growing pile.
 */

/** One exam or exercise session: the unit keys and submissions are grouped under. */
export interface Test {
  /** Slug, validated by isValidTestId. Used in paths and query strings. */
  id: string
  /** What the lecturer typed, shown everywhere in the UI. */
  label: string
  createdAt: string
}

export interface ExamKey {
  /**
   * The 6-hex key a student types. Unique across ALL tests, not just within one - a
   * student types the key and nothing else, so it is the only thing available to look up.
   */
  key: string
  /** Which test this key was issued for. */
  testId: string
  /** Who it belongs to, as the lecturer typed it. */
  name: string
  createdAt: string
  /** Set when withdrawn. Revoked keys still resolve, so old submissions stay attributable. */
  revokedAt?: string
}

export interface Submission {
  id: string
  /** Denormalised from the key, like studentName: moving a key must not move history. */
  testId: string
  examKey: string
  /** Denormalised on purpose: a renamed or revoked key must not rewrite history. */
  studentName: string
  url: string
  /** Which playground the snapshot came from, derived from its file names on submit. */
  mode: 'browser' | 'vue' | 'node'
  submittedAt: string
}

/** A test plus what it holds, for the picker and the overview. */
export interface TestSummary extends Test {
  keyCount: number
  submissionCount: number
}

export interface TestStore {
  list(): Promise<TestSummary[]>
  get(id: string): Promise<Test | null>
  /** Derives the id from the label; rejects a label that slugifies to nothing. */
  create(label: string): Promise<Test>
}

export interface KeyStore {
  /**
   * Look up by key alone, across every test. The student types six characters and the
   * server works out the rest, so this cannot take a testId.
   */
  find(key: string): Promise<ExamKey | null>
  list(filter?: { testId?: string }): Promise<ExamKey[]>
  /** Mints the key itself; returns the created record. Fails if the test does not exist. */
  create(testId: string, name: string): Promise<ExamKey>
  revoke(key: string): Promise<void>
}

export interface SubmissionStore {
  add(input: Omit<Submission, 'id' | 'submittedAt'>): Promise<Submission>
  list(filter?: { testId?: string; examKey?: string }): Promise<Submission[]>
  get(id: string): Promise<Submission | null>
}
