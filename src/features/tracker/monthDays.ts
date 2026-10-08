/**
 * The days of one month, as the grid header needs them.
 *
 * Pure and local: the month is addressed by its `YYYY-MM` key, each day is
 * built by splitting that key and constructing a local `Date`, and the weekday
 * letter comes from @/lib/dates. Nothing here converts to UTC, so the 1st of the
 * month is the 1st wherever the device is.
 */
import { parseDateString, toDateString, weekdayLetter } from '@/lib/dates'
import { daysInMonth } from '@/lib/stats'
import { monthName } from './monthParam'
import type { DateString, MonthKey } from '@/types'

export interface MonthDay {
  /** `YYYY-MM-DD` in the user's own calendar. */
  date: DateString
  /** Day of the month, 1 to 31. */
  day: number
  /** `M` to `S`, Monday first. */
  weekday: string
  /** Saturday or Sunday, which the grid shades. */
  weekend: boolean
  /** `9 October 2026`, for an accessible name. */
  label: string
}

export function monthDays(monthKey: MonthKey): MonthDay[] {
  const [yearText] = monthKey.split('-')
  const total = daysInMonth(monthKey)
  const name = monthName(monthKey)
  const days: MonthDay[] = []

  for (let day = 1; day <= total; day += 1) {
    const date = parseDateString(`${monthKey}-${day.toString().padStart(2, '0')}`)
    const weekdayIndex = date.getDay()

    days.push({
      date: toDateString(date),
      day,
      weekday: weekdayLetter(date),
      weekend: weekdayIndex === 0 || weekdayIndex === 6,
      label: `${day} ${name} ${yearText ?? ''}`.trim(),
    })
  }

  return days
}
