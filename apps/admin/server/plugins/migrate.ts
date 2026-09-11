import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  IMPORTED_TEST_ID,
  IMPORTED_TEST_LABEL,
  decodeHash,
  detectMode,
  type ExamKey,
  type Submission,
  type Test,
} from '@playground/shared'

/**
 * Import data written before tests existed, into the test that represents it.
 *
 * Two older layouts can be on disk, and both land in the same place:
 *
 *   pre-workspace  `data/allowed-keys` (a JSON array of {name, key}) plus one file per
 *                  submission under `uploads/`, each holding a bare URL and nothing else -
 *                  no timestamp, no student name, no mode.
 *   flat           `<storage>/keys.json` plus `<storage>/submissions/*.json`, which is
 *                  what this app wrote before keys and submissions were grouped.
 *
 * Both are records of real exams, so they are converted rather than abandoned. Everything
 * goes under one test, because it IS one cohort - scattering it across invented groups
 * would be a worse lie than putting it in a group named for what it is.
 *
 * Runs only when that test does not exist yet, and renames its sources afterwards so a
 * restart cannot import them twice.
 */
export default defineNitroPlugin(async () => {
  const baseDir = resolve(useRuntimeConfig().storageDir)
  const testDir = join(baseDir, 'tests', IMPORTED_TEST_ID)
  const submissionsDir = join(testDir, 'submissions')

  if (existsSync(testDir)) return

  // The pre-workspace dirs sat next to the app; storageDir may now point elsewhere.
  const legacyKeysFile = resolve('./data/allowed-keys')
  const legacyUploadsDir = resolve('./uploads')
  const flatKeysFile = join(baseDir, 'keys.json')
  const flatSubmissionsDir = join(baseDir, 'submissions')

  const sources = [legacyKeysFile, legacyUploadsDir, flatKeysFile, flatSubmissionsDir]
  if (!sources.some(existsSync)) return

  console.log('[migrate] importing earlier data into tests/' + IMPORTED_TEST_ID)
  await mkdir(submissionsDir, { recursive: true })

  const test: Test = {
    id: IMPORTED_TEST_ID,
    label: IMPORTED_TEST_LABEL,
    createdAt: new Date().toISOString(),
  }
  await writeFile(join(testDir, 'test.json'), JSON.stringify(test, null, 2), 'utf8')

  const keys: ExamKey[] = []
  const byKey = new Map<string, ExamKey>()
  const addKey = (record: ExamKey) => {
    if (byKey.has(record.key)) return
    keys.push(record)
    byKey.set(record.key, record)
  }

  // --- keys -----------------------------------------------------------------

  if (existsSync(flatKeysFile)) {
    try {
      const parsed = JSON.parse(await readFile(flatKeysFile, 'utf8')) as ExamKey[]
      for (const entry of Array.isArray(parsed) ? parsed : []) {
        if (entry?.key && entry?.name) addKey({ ...entry, testId: IMPORTED_TEST_ID })
      }
    } catch (error) {
      console.warn('[migrate] could not read keys.json:', error)
    }
  }

  if (existsSync(legacyKeysFile)) {
    try {
      const parsed = JSON.parse(await readFile(legacyKeysFile, 'utf8')) as { name: string; key: string }[]
      const createdAt = test.createdAt
      for (const entry of Array.isArray(parsed) ? parsed : []) {
        if (entry?.key && entry?.name) {
          addKey({ key: entry.key, testId: IMPORTED_TEST_ID, name: entry.name, createdAt })
        }
      }
    } catch (error) {
      console.warn('[migrate] could not read data/allowed-keys:', error)
    }
  }

  await writeFile(join(testDir, 'keys.json'), JSON.stringify(keys, null, 2), 'utf8')
  console.log(`[migrate] ${keys.length} exam keys`)

  // --- submissions ----------------------------------------------------------

  let imported = 0

  const writeRecord = async (record: Submission) => {
    await writeFile(join(submissionsDir, `${record.id}.json`), JSON.stringify(record, null, 2), 'utf8')
    imported++
  }

  if (existsSync(flatSubmissionsDir)) {
    for (const name of await readdir(flatSubmissionsDir)) {
      if (!name.endsWith('.json')) continue
      try {
        const record = JSON.parse(await readFile(join(flatSubmissionsDir, name), 'utf8')) as Submission
        await writeRecord({ ...record, testId: IMPORTED_TEST_ID })
      } catch (error) {
        console.warn(`[migrate] skipped ${name}:`, error)
      }
    }
  }

  if (existsSync(legacyUploadsDir)) {
    for (const name of await readdir(legacyUploadsDir)) {
      try {
        const url = (await readFile(join(legacyUploadsDir, name), 'utf8')).trim()
        if (!url.startsWith('http')) continue

        // Filenames were `<slug of name>.<key>`, so the key is the last dot-segment.
        const examKey = name.slice(name.lastIndexOf('.') + 1)
        const known = byKey.get(examKey)
        const files = await decodeHash(new URL(url).hash)

        await writeRecord({
          // Timestamps were never stored, so the id carries the filename instead of a
          // fabricated date. submittedAt is left empty rather than invented - see below.
          id: `legacy-${name.replace(/[^A-Za-z0-9_-]+/g, '_')}`,
          testId: IMPORTED_TEST_ID,
          examKey,
          studentName: known?.name ?? name.slice(0, name.lastIndexOf('.')).replace(/_/g, ' '),
          url,
          mode: files ? detectMode(files) : 'browser',
          // Empty string, not a made-up date: the review UI shows "unknown" and nobody is
          // misled into thinking this was recorded at import time.
          submittedAt: '',
        })
      } catch (error) {
        console.warn(`[migrate] skipped ${name}:`, error)
      }
    }
  }

  console.log(`[migrate] ${imported} submissions`)

  // Rename rather than delete, so this cannot run twice and the originals stay recoverable.
  for (const source of sources) {
    if (existsSync(source)) await rename(source, `${source}.imported`).catch(() => {})
  }
  console.log('[migrate] done; sources renamed to *.imported')
})
