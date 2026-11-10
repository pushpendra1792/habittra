/**
 * Short, readable calendar labels for the dashboard.
 *
 * `parseDateString` builds a local date by splitting the stored `YYYY-MM-DD`
 * string. Nothing here goes through `toISOString()` or UTC, so the label always
 * names the day the user actually checked in.
 */
import { parseDateString } from '@/lib/dates'
import type { DateString } from '@/types'

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Formats a stored date as `Oct 1, 2026`, or returns it unchanged if invalid. */
export function formatShortDate(value: DateString): string {
  const date = parseDateString(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${SHORT_MONTHS[date.getMonth()] ?? ''} ${date.getDate()}, ${date.getFullYear()}`
}
