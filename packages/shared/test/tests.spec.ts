import { describe, expect, it } from 'vitest'
import { isValidTestId, slugifyTestId } from '../src/tests'

describe('slugifyTestId', () => {
  it('builds an id from what a lecturer would actually type', () => {
    expect(slugifyTestId('Webdev examen januari 2027')).toBe('webdev-examen-januari-2027')
  })

  it('folds accents instead of dropping them', () => {
    // Dropping would collide two different names; leaving them raw would make one test
    // reachable under two directory spellings depending on NFC/NFD normalisation.
    expect(slugifyTestId('Systeemanalyse — hérkansing')).toBe('systeemanalyse-herkansing')
  })

  it('collapses punctuation and trims the edges', () => {
    expect(slugifyTestId('  JS / Node: herexamen!!  ')).toBe('js-node-herexamen')
  })

  it('returns empty when nothing usable survives, rather than inventing an id', () => {
    expect(slugifyTestId('!!!')).toBe('')
    expect(slugifyTestId('   ')).toBe('')
  })

  it('stays within the length limit without a trailing dash', () => {
    const id = slugifyTestId('x'.repeat(60) + ' ' + 'y'.repeat(20))
    expect(id.length).toBeLessThanOrEqual(64)
    expect(id.endsWith('-')).toBe(false)
    expect(isValidTestId(id)).toBe(true)
  })

  it('always produces something the validator accepts', () => {
    for (const label of ['Exam 1', 'ë', 'A-B-C', '2027', 'Herexamen (tweede zit)']) {
      const id = slugifyTestId(label)
      if (id) expect(isValidTestId(id)).toBe(true)
    }
  })
})

describe('isValidTestId', () => {
  it.each(['exam', 'webdev-2027', 'a', '2027-01-15'])('accepts %s', id => {
    expect(isValidTestId(id)).toBe(true)
  })

  // Everything below would be used as a directory name, so these are the cases that keep
  // a request from climbing out of the storage directory.
  it.each([
    ['empty', ''],
    ['traversal', '..'],
    ['nested traversal', '../../etc'],
    ['separator', 'a/b'],
    ['backslash', 'a\\b'],
    ['uppercase', 'Exam'],
    ['leading dash', '-exam'],
    ['space', 'exam 1'],
    ['dot', 'exam.1'],
    ['too long', 'a'.repeat(65)],
    ['null', null],
    ['number', 7],
  ])('rejects %s', (_label, id) => {
    expect(isValidTestId(id)).toBe(false)
  })
})
