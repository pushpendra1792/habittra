import { describe, expect, it } from 'vitest'

import { columnWash } from './columnWash'
import type { MonthDay } from './monthDays'

function day(overrides: Partial<MonthDay>): MonthDay {
  return {
    date: '2026-10-09',
    day: 9,
    weekday: 'F',
    weekend: false,
    label: '9 October 2026',
    ...overrides,
  }
}

describe('columnWash', () => {
  it('tints today with the accent', () => {
    expect(columnWash(day({ date: '2026-10-09' }), '2026-10-09')).toBe('bg-accent-teal/8')
  })

  it('shades a weekend day that is not today', () => {
    // Saturday the 10th, with today still the 9th.
    expect(columnWash(day({ date: '2026-10-10', weekend: true }), '2026-10-09')).toBe(
      'bg-text-on-light/5',
    )
  })

  it('gives an ordinary weekday no wash at all', () => {
    expect(columnWash(day({ date: '2026-10-08' }), '2026-10-09')).toBe('')
  })

  it('lets today win when today is also a weekend day', () => {
    const sunday = day({ date: '2026-10-11', weekend: true, weekday: 'S' })

    expect(columnWash(sunday, '2026-10-11')).toBe('bg-accent-teal/8')
  })

  it('still shades the weekend of a month that is not the current one', () => {
    expect(columnWash(day({ date: '2026-12-24', weekend: true }), '2026-10-09')).toBe(
      'bg-text-on-light/5',
    )
    expect(columnWash(day({ date: '2026-01-15' }), '2026-10-09')).toBe('')
  })
})
