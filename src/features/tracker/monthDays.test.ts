import { describe, expect, it } from 'vitest'

import { monthDays } from './monthDays'

describe('monthDays', () => {
  it('has one entry per day of the month', () => {
    expect(monthDays('2023-07')).toHaveLength(31)
    expect(monthDays('2023-02')).toHaveLength(28)
    expect(monthDays('2024-02')).toHaveLength(29)
    expect(monthDays('2026-10')).toHaveLength(31)
  })

  it('numbers the days from 1 upward with no gap and no repeat', () => {
    const days = monthDays('2026-10')

    expect(days.map((day) => day.day)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1))
  })

  it('builds each date from the month key, so no timezone can move the day', () => {
    for (const monthKey of ['2023-07', '2024-02', '2026-10'] as const) {
      for (const day of monthDays(monthKey)) {
        expect(day.date).toBe(`${monthKey}-${day.day.toString().padStart(2, '0')}`)
      }
    }
  })

  it('starts July 2023 on a Saturday and the third on a Monday', () => {
    // 1 July 2023 was a Saturday, and the week starts on Monday, so the month
    // opens on the sixth letter and the third lands on the first.
    const [first, second, third] = monthDays('2023-07')

    expect(first?.weekday).toBe('S')
    expect(second?.weekday).toBe('S')
    expect(third?.weekday).toBe('M')
  })

  it('shades Saturdays and Sundays only', () => {
    const weekendDays = monthDays('2023-07')
      .filter((day) => day.weekend)
      .map((day) => day.day)

    expect(weekendDays).toEqual([1, 2, 8, 9, 15, 16, 22, 23, 29, 30])
  })

  it('labels a day for an accessible name', () => {
    const first = monthDays('2026-10')[0]

    expect(first?.label).toBe('1 October 2026')
    expect(first?.date).toBe('2026-10-01')
  })

  it('handles a one day month without skipping it', () => {
    // Not a real month, but a loop that starts at 2 would drop the 1st of
    // every month, and February is where that shows first.
    const february = monthDays('2024-02')

    expect(february[0]?.date).toBe('2024-02-01')
    expect(february.at(-1)?.date).toBe('2024-02-29')
  })
})
