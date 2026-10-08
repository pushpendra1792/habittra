/**
 * The month in the address bar.
 *
 * The tracker shows one month at a time and the month lives in `?m=YYYY-MM`,
 * so a refresh, a bookmark and the back button all land on the same month the
 * user was looking at. Everything here is local calendar: the current month
 * comes from `todayString()`, which never converts to UTC.
 */
import { todayString } from '@/lib/dates'
import type { MonthKey } from '@/types'

const YEAR_PATTERN = /^\d{4}$/
const MONTH_PATTERN = /^(0[1-9]|1[0-2])$/

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** The month the device is in right now, in the user's own timezone. */
export function currentMonthKey(): MonthKey {
  // The slice is a prefix of a zero padded date, so it is always `YYYY-MM`.
  // The cast says so to the compiler, which cannot prove string lengths.
  return todayString().slice(0, 7) as MonthKey
}

/**
 * Reads `?m=` as a month, falling back for anything that is not one.
 *
 * Missing, empty, `2026-1`, `2026-13`, `2026-00`, `2026-10-01`, `abc` and a
 * padded value all fall back rather than throwing: a hand edited or truncated
 * URL should show this month, not an error page.
 *
 * The month is bounded to 01-12 rather than left to `new Date`, because
 * `new Date(2026, 13, 1)` quietly rolls into January of the next year and a
 * month nobody chose would be shown as if they had chosen it.
 */
export function parseMonthParam(value: string | null, fallback: MonthKey): MonthKey {
  if (value === null) {
    return fallback
  }

  const [year, month, ...rest] = value.split('-')

  if (rest.length > 0 || year === undefined || month === undefined) {
    return fallback
  }

  if (!YEAR_PATTERN.test(year) || !MONTH_PATTERN.test(month)) {
    return fallback
  }

  return `${year}-${month}` as MonthKey
}

/** The month name, e.g. `October`. Returns '' for a malformed key. */
export function monthName(monthKey: MonthKey): string {
  const [, monthText] = monthKey.split('-')
  const index = Number(monthText) - 1

  return MONTH_NAMES[index] ?? ''
}

/** `October 2026` for the switcher. */
export function monthLabel(monthKey: MonthKey): string {
  const [year] = monthKey.split('-')

  return `${monthName(monthKey)} ${year ?? ''}`.trim()
}
