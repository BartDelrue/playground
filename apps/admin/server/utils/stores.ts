import { mkdir, readFile, readdir, writeFile, rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  isValidTestId,
  newExamKey,
  slugifyTestId,
  type ExamKey,
  type KeyStore,
  type Submission,
  type SubmissionStore,
  type Test,
  type TestStore,
  type TestSummary,
} from '@playground/shared'

/**
 * File-backed stores, grouped by test.
 *
 *   <storageDir>/tests/<testId>/test.json
 *   <storageDir>/tests/<testId>/keys.json
 *   <storageDir>/tests/<testId>/submissions/<submissionId>.json
 *
 * One directory per test means a cohort can be copied, archived or handed over as a unit -
 * which is most of the point of grouping at all. It also means that listing or exporting
 * one test never reads another's files.
 *
 * Deliberately behind the interfaces in @playground/shared so this can become SQLite
 * without a caller changing. The base directory is a constructor argument rather than a
 * hardcoded './data' - Nitro resolves nuxt.config storage mounts at BUILD time, so a baked
 * path could not be pointed at a mounted volume at run time.
 */

/**
 * Serialise read-modify-write across the whole store, not per test.
 *
 * Per-test would be finer, but key creation has to check uniqueness across every test (a
 * student types the key alone), so the critical section spans all of them anyway. One
 * admin process, so an in-process promise chain is a complete fix rather than a
 * mitigation: two concurrent create() calls could otherwise both read the same array and
 * the second write would silently drop the first key.
 */
function serialiser() {
  let tail: Promise<unknown> = Promise.resolve()
  return function run<T>(job: () => Promise<T>): Promise<T> {
    const result = tail.then(job, job)
    // Keep the chain alive even if a job rejects, or every later call inherits the failure.
    tail = result.catch(() => {})
    return result
  }
}

async function writeAtomic(path: string, contents: string): Promise<void> {
  // Write beside the target and rename, so a crash mid-write cannot leave a truncated
  // JSON file where the key list used to be.
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, contents, 'utf8')
  await rename(temp, path)
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

/**
 * Shared root. The three stores each own part of a test's directory, so they agree on how
 * that directory is addressed rather than each building paths their own way.
 */
class TestLayout {
  readonly root: string

  constructor(baseDir: string) {
    this.root = join(resolve(baseDir), 'tests')
  }

  /**
   * Path to one test's directory.
   *
   * Throws on an invalid id rather than returning something harmless. The id reaches here
   * from a query string and a request body, and it becomes a directory name: a value
   * containing `..` or a separator would climb out of the storage directory. Validating at
   * the one place every path is built means no caller can forget.
   */
  dir(testId: string): string {
    if (!isValidTestId(testId)) {
      throw createError({ statusCode: 400, statusMessage: `Not a test identifier: ${testId}` })
    }
    return join(this.root, testId)
  }

  testFile(testId: string): string {
    return join(this.dir(testId), 'test.json')
  }

  keysFile(testId: string): string {
    return join(this.dir(testId), 'keys.json')
  }

  submissionsDir(testId: string): string {
    return join(this.dir(testId), 'submissions')
  }

  /** Every test id on disk, oldest-named first; the caller sorts properly. */
  async ids(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory() && isValidTestId(entry.name))
        .map(entry => entry.name)
    } catch {
      return []
    }
  }

  async keysOf(testId: string): Promise<ExamKey[]> {
    const keys = await readJson<ExamKey[]>(this.keysFile(testId), [])
    return Array.isArray(keys) ? keys : []
  }
}

export class FileTestStore implements TestStore {
  private readonly run = serialiser()

  constructor(private readonly layout: TestLayout) {}

  async get(id: string): Promise<Test | null> {
    if (!isValidTestId(id)) return null
    const test = await readJson<Test | null>(this.layout.testFile(id), null)
    return test?.id ? test : null
  }

  async list(): Promise<TestSummary[]> {
    const ids = await this.layout.ids()
    const summaries = await Promise.all(ids.map(async id => {
      const test = await this.get(id)
      if (!test) return null

      const keys = await this.layout.keysOf(id)
      let submissionCount = 0
      try {
        submissionCount = (await readdir(this.layout.submissionsDir(id))).filter(n => n.endsWith('.json')).length
      } catch { /* no submissions yet */ }

      return { ...test, keyCount: keys.length, submissionCount } satisfies TestSummary
    }))

    return summaries
      .filter((summary): summary is TestSummary => summary !== null)
      // Newest first: the test being run today is the one being looked at.
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async create(label: string): Promise<Test> {
    const trimmed = label.trim()
    const id = slugifyTestId(trimmed)
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'That name has no letters or digits to build an identifier from' })
    }

    return this.run(async () => {
      const existing = await this.get(id)
      if (existing) {
        // Same name twice is a lecturer expecting the test they already made, not a
        // request for a second one that would silently split a cohort in two.
        throw createError({ statusCode: 409, statusMessage: `A test called "${existing.label}" already exists` })
      }

      const test: Test = { id, label: trimmed, createdAt: new Date().toISOString() }
      await mkdir(this.layout.submissionsDir(id), { recursive: true })
      await writeAtomic(this.layout.testFile(id), JSON.stringify(test, null, 2))
      return test
    })
  }
}

export class FileKeyStore implements KeyStore {
  private readonly run = serialiser()

  constructor(private readonly layout: TestLayout, private readonly tests: TestStore) {}

  /**
   * Scans every test, because a student submits a key and nothing else.
   *
   * That is a handful of small JSON reads per submission. At this scale it is far cheaper
   * than the index that would have to be kept correct alongside it; when this becomes
   * SQLite the key column carries a unique index and the question disappears.
   */
  async find(key: string): Promise<ExamKey | null> {
    for (const testId of await this.layout.ids()) {
      const found = (await this.layout.keysOf(testId)).find(entry => entry.key === key)
      if (found) return found
    }
    return null
  }

  async list(filter?: { testId?: string }): Promise<ExamKey[]> {
    const ids = filter?.testId ? [filter.testId] : await this.layout.ids()
    const perTest = await Promise.all(ids.map(id => this.layout.keysOf(id)))
    return perTest.flat().sort((a, b) => a.name.localeCompare(b.name, 'nl'))
  }

  async create(testId: string, name: string): Promise<ExamKey> {
    return this.run(async () => {
      if (!await this.tests.get(testId)) {
        throw createError({ statusCode: 404, statusMessage: `No such test: ${testId}` })
      }

      // Uniqueness is global: find() has only the key to go on.
      const taken = new Set<string>()
      for (const id of await this.layout.ids()) {
        for (const entry of await this.layout.keysOf(id)) taken.add(entry.key)
      }

      let key = newExamKey()
      while (taken.has(key)) key = newExamKey()

      const created: ExamKey = { key, testId, name: name.trim(), createdAt: new Date().toISOString() }
      const keys = await this.layout.keysOf(testId)
      await writeAtomic(this.layout.keysFile(testId), JSON.stringify([...keys, created], null, 2))
      return created
    })
  }

  async revoke(key: string): Promise<void> {
    return this.run(async () => {
      // Find the owning test first; rewriting every test's file would turn one revocation
      // into a write across the whole store.
      for (const testId of await this.layout.ids()) {
        const keys = await this.layout.keysOf(testId)
        if (!keys.some(entry => entry.key === key && !entry.revokedAt)) continue

        const next = keys.map(entry =>
          entry.key === key
            // Revoked, never deleted: a submission made with this key stays attributable.
            ? { ...entry, revokedAt: new Date().toISOString() }
            : entry)
        await writeAtomic(this.layout.keysFile(testId), JSON.stringify(next, null, 2))
        return
      }
    })
  }
}

export class FileSubmissionStore implements SubmissionStore {
  constructor(private readonly layout: TestLayout) {}

  /**
   * One file per submission, under its test, named by an id minted here.
   *
   * This is what replaced scanning for a free `name-1`, `name-2` suffix. That scan was a
   * check-then-write race: two submissions arriving together both saw the same free slot
   * and one silently overwrote the other - at a deadline, with everyone submitting at
   * once, exactly when you could least afford it.
   */
  async add(input: Omit<Submission, 'id' | 'submittedAt'>): Promise<Submission> {
    const dir = this.layout.submissionsDir(input.testId)
    await mkdir(dir, { recursive: true })

    const submittedAt = new Date().toISOString()
    const id = `${submittedAt.replace(/[:.]/g, '-')}-${newExamKey()}`
    const record: Submission = { ...input, id, submittedAt }
    // 'wx' fails rather than overwrites if the id somehow already exists.
    await writeFile(join(dir, `${id}.json`), JSON.stringify(record, null, 2), { encoding: 'utf8', flag: 'wx' })
    return record
  }

  private async readTest(testId: string): Promise<Submission[]> {
    const dir = this.layout.submissionsDir(testId)
    let names: string[]
    try {
      names = (await readdir(dir)).filter(n => n.endsWith('.json'))
    } catch {
      return []
    }

    const records = await Promise.all(names.map(name => readJson<Submission | null>(join(dir, name), null)))
    return records.filter((record): record is Submission => record !== null)
  }

  async list(filter?: { testId?: string; examKey?: string }): Promise<Submission[]> {
    const ids = filter?.testId ? [filter.testId] : await this.layout.ids()
    const perTest = await Promise.all(ids.map(id => this.readTest(id)))

    return perTest.flat()
      .filter(record => !filter?.examKey || record.examKey === filter.examKey)
      // Imported records have no timestamp, so they sort last rather than jumping to the
      // top of every list.
      .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''))
  }

  /**
   * Ids stay opaque - they do not encode their test - so this scans. It is the rare path
   * (the portal lists; it does not fetch one submission by id), and keeping ids free of
   * structure is what lets the store change shape later.
   */
  async get(id: string): Promise<Submission | null> {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return null
    for (const testId of await this.layout.ids()) {
      const found = await readJson<Submission | null>(join(this.layout.submissionsDir(testId), `${id}.json`), null)
      if (found) return found
    }
    return null
  }
}

let layout: TestLayout | null = null
let testStore: TestStore | null = null
let keyStore: KeyStore | null = null
let submissionStore: SubmissionStore | null = null

function useLayout(): TestLayout {
  return (layout ??= new TestLayout(useRuntimeConfig().storageDir))
}

export function useTestStore(): TestStore {
  return (testStore ??= new FileTestStore(useLayout()))
}

export function useKeyStore(): KeyStore {
  return (keyStore ??= new FileKeyStore(useLayout(), useTestStore()))
}

export function useSubmissionStore(): SubmissionStore {
  return (submissionStore ??= new FileSubmissionStore(useLayout()))
}
