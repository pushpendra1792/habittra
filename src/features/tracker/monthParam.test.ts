import { describe, expect, it } from 'vitest'

import { currentMonthKey, monthLabel, monthName, parseMonthParam } from './monthParam'

describe('parseMonthParam', () => {
  it('reads a well formed month', () => {
    expect(parseMonthParam('2026-10', '2023-07')).toBe('2026-10')
    expect(parseMonthParam('2023-01', '2023-07')).toBe('2023-01')
    expect(parseMonthParam('2023-12', '2023-07')).toBe('2023-12')
  })

  it('falls back when the parameter is missing or empty', () => {
    expect(parseMonthParam(null, '2023-07')).toBe('2023-07')
    expect(parseMonthParam('', '2023-07')).toBe('2023-07')
  })

  it('falls back rather than showing a month nobody chose', () => {
    for (const value of [
      '2026-13',
      '2026-00',
      '2026-1',
      '2026-001',
      '26-10',
      '2026-10-01',
      '2026-10-01T00:00:00Z',
      '2026/10',
      'October 2026',
      ' 2026-10',
      '2026-10 ',
      'abcd-ef',
      '-10',
    ]) {
      expect(parseMonthParam(value, '2023-07'), value).toBe('2023-07')
    }
  })

  it('does not roll an impossible month into the next year', () => {
    // `new Date(2026, 13, 1)` would quietly become January 2027. A URL that
    // says month 13 is wrong, not early.
    expect(parseMonthParam('2026-13', '2026-12')).toBe('2026-12')
  })

  it('keeps the year even when the month is wrong', () => {
    // Not a behaviour worth depending on: the whole value is rejected, which
    // is the point. Written to say so, so a "helpful" partial parse does not
    // appear later.
    expect(parseMonthParam('2027-13', '2023-07')).toBe('2023-07')
  })
})

describe('currentMonthKey', () => {
  it('is a zero padded YYYY-MM', () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/)
  })

  it('matches the local calendar, not UTC', () => {
    // todayString() uses local getters, so the key can only disagree with the
    // device's own date across midnight. Comparing prefixes is enough to prove
    // it is reading the same calendar the rest of the app writes to.
    const local = new Date()
    const expected = `${local.getFullYear().toString()}-${(local.getMonth() + 1)
      .toString()
      .padStart(2, '0')}`

    expect(currentMonthKey()).toBe(expected)
  })
})

describe('monthName and monthLabel', () => {
  it('names every month', () => {
    expect(monthName('2026-01')).toBe('January')
    expect(monthName('2026-10')).toBe('October')
    expect(monthName('2026-12')).toBe('December')
  })

  it('labels a month with its name and year', () => {
    expect(monthLabel('2026-10')).toBe('October 2026')
    expect(monthLabel('2023-01')).toBe('January 2023')
  })

  it('returns an empty name for a malformed key', () => {
    expect(monthName('2026-13')).toBe('')
    expect(monthName('nonsense' as never)).toBe('')
  })
})
