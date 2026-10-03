/**
 * Calendar helpers.
 *
 * Every function here works in the user's own timezone and in plain
 * `YYYY-MM-DD` / `YYYY-MM` strings. Nothing goes through UTC: `toISOString()`
 * converts to UTC first, which moves a check-in to the wrong day for anyone
 * west of Greenwich in the evening and east of it in the morning. See the date
 * rules in `AGENTS.md`.
 */
import type { DateString, MonthKey } from '@/types'

/** Month keys are compared as strings, which only works zero padded. */
const MONTH_PAD = 2

/**
 * Formats a local `Date` as the calendar day it falls on: `YYYY-MM-DD`.
 *
 * Uses the local getters rather than `toISOString()`, so 23:30 on the 4th stays
 * the 4th no matter where the device is.
 */
export function toDateString(date: Date): DateString {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(MONTH_PAD, '0')
  const day = String(date.getDate()).padStart(MONTH_PAD, '0')

  // padStart guarantees the zero padding, but no type can prove it, so this is
  // the one cast in the file and the reason DateString keeps its template type.
  return `${year}-${month}-${day}` as DateString
}

/**
 * Reads a `YYYY-MM-DD` string as a local `Date` at midnight.
 *
 * Splits on `-` and constructs with the numeric year, month and day arguments.
 * It deliberately avoids `new Date('2023-07-04')`, which the spec parses as UTC
 * and which lands on the 3rd for anyone west of Greenwich.
 *
 * Field order is validated, because `new Date(2023, 13, 1)` silently rolls into
 * January of the next year. Out of range values come back as `Invalid Date`
 * rather than as a plausible wrong day.
 */
export function parseDateString(value: string): Date {
  const [yearText, monthText, dayText, ...rest] = value.split('-')

  if (
    rest.length > 0 ||
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined
  ) {
    return new Date(Number.NaN)
  }

  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (yearText.length !== 4 || monthText.length !== MONTH_PAD || dayText.length !== MONTH_PAD) {
    return new Date(Number.NaN)
  }

  const parsed = new Date(year, month - 1, day)

  // The constructor rolls impossible dates forward: 31 February becomes
  // 2 or 3 March. Reject instead of returning a day nobody asked for.
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return new Date(Number.NaN)
  }

  return parsed
}

/** Today in the user's own timezone, as `YYYY-MM-DD`. */
export function todayString(): DateString {
  return toDateString(new Date())
}

/**
 * Shifts a month key by `count` months, forwards or backwards.
 *
 * Uses the local `Date` month arithmetic on the year and month numbers alone,
 * so it is not affected by the day of the month or by any timezone shift. A
 * `count` of 0 returns the same month.
 */
export function addMonths(monthKey: MonthKey, count: number): MonthKey {
  const [yearText, monthText] = monthKey.split('-')

  if (yearText === undefined || monthText === undefined) {
    return monthKey
  }

  // Month indexes are zero based: 2023-07 -> 6.
  const zeroBased = Number(monthText) - 1 + Math.trunc(count)
  const year = Number(yearText) + Math.floor(zeroBased / 12)
  const month = ((zeroBased % 12) + 12) % 12

  const built = `${year}-${String(month + 1).padStart(MONTH_PAD, '0')}`

  return built as MonthKey
}

/**
 * The single-letter weekday for a date: `'M'`, `'T'`, `'W'`, `'T'`, `'F'`,
 * `'S'`, `'S'` for Monday to Sunday.
 *
 * Week starts on Monday, matching `toLocaleDateString('en-GB')` and the habit
 * grid. `getDay()` is 0 for Sunday, so it is rotated by one.
 */
export function weekdayLetter(date: Date): string {
  const mondayFirstIndex = (date.getDay() + 6) % 7

  return 'MTWTFSS'[mondayFirstIndex] ?? ''
}
