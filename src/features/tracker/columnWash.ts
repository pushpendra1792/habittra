/**
 * What wash sits behind a day column.
 *
 * Three states and no more: today, the weekend, and an ordinary day. Today
 * wins over the weekend, because the two can fall on the same cell and a
 * Sunday that is also today is the day the user is looking for.
 *
 * The classes live here rather than in the component so the rule is a pure
 * function with a test, instead of a branch buried in markup.
 */
import type { MonthDay } from './monthDays'
import type { DateString } from '@/types'

/** An empty string means no wash: the cell keeps the panel's own colour. */
export function columnWash(day: MonthDay, today: DateString): string {
  if (day.date === today) {
    return 'bg-accent-teal/10'
  }

  if (day.weekend) {
    return 'bg-text-on-light/5'
  }

  return ''
}
