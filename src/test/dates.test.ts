import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addMonths, parseDateString, toDateString, todayString, weekdayLetter } from '@/lib/dates'

/** Local midnight, so no test depends on the time of day it runs at. */
function localDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(year, month - 1, day, hours, minutes)
}

describe('toDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateString(localDate(2023, 7, 4))).toBe('2023-07-04')
  })

  it('zero pads single digit months and days', () => {
    expect(toDateString(localDate(2023, 1, 9))).toBe('2023-01-09')
  })

  it('keeps the first day of a month on the first', () => {
    expect(toDateString(localDate(2023, 7, 1))).toBe('2023-07-01')
  })

  it('keeps the last day of a month on the last', () => {
    expect(toDateString(localDate(2023, 7, 31))).toBe('2023-07-31')
    expect(toDateString(localDate(2024, 2, 29))).toBe('2024-02-29')
  })

  it('uses the local day at the end of the day, not the UTC one', () => {
    // 23:30 local on the 4th. Anywhere west of Greenwich, toISOString() would
    // already be on the 5th.
    expect(toDateString(localDate(2023, 7, 4, 23, 30))).toBe('2023-07-04')
  })

  it('uses the local day at the start of the day, not the UTC one', () => {
    // 00:30 local on the 5th. Anywhere east of Greenwich, toISOString() would
    // still be on the 4th.
    expect(toDateString(localDate(2023, 7, 5, 0, 30))).toBe('2023-07-05')
  })

  it('handles years below 1000 without padding them out', () => {
    expect(toDateString(localDate(999, 12, 31))).toBe('999-12-31')
  })
})

describe('parseDateString', () => {
  it('reads a date string as local midnight', () => {
    const parsed = parseDateString('2023-07-04')

    expect(parsed.getFullYear()).toBe(2023)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(4)
    expect(parsed.getHours()).toBe(0)
    expect(parsed.getMinutes()).toBe(0)
  })

  it('round trips with toDateString', () => {
    for (const value of ['2023-07-01', '2023-07-31', '2024-02-29', '2023-01-09', '2019-12-31']) {
      expect(toDateString(parseDateString(value))).toBe(value)
    }
  })

  it('rejects a day that does not exist in the month', () => {
    expect(Number.isNaN(parseDateString('2023-02-29').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-02-30').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-04-31').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-06-31').getTime())).toBe(true)
  })

  it('accepts the last day of every month length', () => {
    for (const value of [
      '2023-02-28',
      '2024-02-29',
      '2023-04-30',
      '2023-01-31',
      '2000-02-29',
      '1900-03-01',
    ]) {
      expect(Number.isNaN(parseDateString(value).getTime())).toBe(false)
    }
  })

  it('rejects a 29 February in a century that is not a leap year', () => {
    expect(Number.isNaN(parseDateString('1900-02-29').getTime())).toBe(true)
  })

  it('rejects months outside 1 to 12 rather than rolling into the next year', () => {
    expect(Number.isNaN(parseDateString('2023-13-01').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-00-01').getTime())).toBe(true)
  })

  it('rejects day 0 and day 32', () => {
    expect(Number.isNaN(parseDateString('2023-07-00').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-07-32').getTime())).toBe(true)
  })

  it('rejects an unpadded month or day', () => {
    expect(Number.isNaN(parseDateString('2023-7-04').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-07-4').getTime())).toBe(true)
  })

  it('rejects a string with a time or a timezone attached', () => {
    expect(Number.isNaN(parseDateString('2023-07-04T00:00:00Z').getTime())).toBe(true)
    expect(Number.isNaN(parseDateString('2023-07-04T00:00:00.000Z').getTime())).toBe(true)
  })

  it('rejects malformed input', () => {
    for (const value of ['', '2023', '2023-07', 'not-a-date', 'July 2023', '2023-07-04-05']) {
      expect(Number.isNaN(parseDateString(value).getTime())).toBe(true)
    }
  })
})

describe('todayString', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the local calendar day', () => {
    vi.setSystemTime(new Date(2023, 6, 22, 14, 5))

    expect(todayString()).toBe('2023-07-22')
  })

  it('does not roll forward at the end of the day', () => {
    vi.setSystemTime(new Date(2023, 6, 22, 23, 59, 59))

    expect(todayString()).toBe('2023-07-22')
  })

  it('does not roll back at the start of the day', () => {
    vi.setSystemTime(new Date(2023, 6, 23, 0, 0, 0))

    expect(todayString()).toBe('2023-07-23')
  })
})

describe('addMonths', () => {
  it('adds a month within the same year', () => {
    expect(addMonths('2023-01', 1)).toBe('2023-02')
    expect(addMonths('2023-06', 3)).toBe('2023-09')
    expect(addMonths('2023-12', 0)).toBe('2023-12')
  })

  it('wraps forward across a year boundary', () => {
    expect(addMonths('2023-12', 1)).toBe('2024-01')
    expect(addMonths('2023-11', 2)).toBe('2024-01')
    expect(addMonths('2023-01', 12)).toBe('2024-01')
  })

  it('wraps backward across a year boundary', () => {
    expect(addMonths('2023-01', -1)).toBe('2022-12')
    expect(addMonths('2023-02', -2)).toBe('2022-12')
    expect(addMonths('2023-03', -12)).toBe('2022-03')
  })

  it('walks every month of a year in order and back again', () => {
    expect(Array.from({ length: 12 }, (_, index) => addMonths('2023-01', index))).toEqual([
      '2023-01',
      '2023-02',
      '2023-03',
      '2023-04',
      '2023-05',
      '2023-06',
      '2023-07',
      '2023-08',
      '2023-09',
      '2023-10',
      '2023-11',
      '2023-12',
    ])

    expect(Array.from({ length: 12 }, (_, index) => addMonths('2023-12', -index))).toEqual([
      '2023-12',
      '2023-11',
      '2023-10',
      '2023-09',
      '2023-08',
      '2023-07',
      '2023-06',
      '2023-05',
      '2023-04',
      '2023-03',
      '2023-02',
      '2023-01',
    ])
  })

  it('crosses a leap day without complaint', () => {
    expect(addMonths('2024-02', 1)).toBe('2024-03')
    expect(addMonths('2024-01', 13)).toBe('2025-02')
  })

  it('handles a leap year plus a large offset', () => {
    expect(addMonths('2024-02', 12)).toBe('2025-02')
    expect(addMonths('2023-07', 60)).toBe('2028-07')
  })

  it('truncates a fractional offset instead of producing a partial month', () => {
    expect(addMonths('2023-07', 1.9)).toBe('2023-08')
    expect(addMonths('2023-07', -1.9)).toBe('2023-06')
  })

  it('returns the same month when the input is malformed', () => {
    expect(addMonths('nope' as `${number}-${number}`, 1)).toBe('nope')
  })
})

describe('weekdayLetter', () => {
  it('starts the week on Monday', () => {
    // 3 July 2023 was a Monday.
    expect(weekdayLetter(localDate(2023, 7, 3))).toBe('M')
    expect(weekdayLetter(localDate(2023, 7, 4))).toBe('T')
    expect(weekdayLetter(localDate(2023, 7, 5))).toBe('W')
    expect(weekdayLetter(localDate(2023, 7, 6))).toBe('T')
    expect(weekdayLetter(localDate(2023, 7, 7))).toBe('F')
    expect(weekdayLetter(localDate(2023, 7, 8))).toBe('S')
    expect(weekdayLetter(localDate(2023, 7, 9))).toBe('S')
  })

  it('labels the first day of a month', () => {
    // 1 July 2023 was a Saturday.
    expect(weekdayLetter(localDate(2023, 7, 1))).toBe('S')
    // 1 September 2023 was a Friday.
    expect(weekdayLetter(localDate(2023, 9, 1))).toBe('F')
    // 1 January 2024 was a Monday.
    expect(weekdayLetter(localDate(2024, 1, 1))).toBe('M')
  })

  it('labels the last day of a 28, 29, 30 and 31 day month', () => {
    expect(weekdayLetter(localDate(2023, 2, 28))).toBe('T')
    expect(weekdayLetter(localDate(2024, 2, 29))).toBe('T')
    expect(weekdayLetter(localDate(2023, 4, 30))).toBe('S')
    expect(weekdayLetter(localDate(2023, 1, 31))).toBe('T')
  })

  it('always returns a single letter from MTWTFSS', () => {
    for (let day = 1; day <= 31; day += 1) {
      expect(weekdayLetter(localDate(2023, 7, day))).toMatch(/^[MTWTFSS]$/)
    }
  })

  it('works on a parsed date string', () => {
    expect(weekdayLetter(parseDateString('2023-07-22'))).toBe('S')
  })
})
