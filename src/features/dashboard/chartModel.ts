/**
 * Presentation maths for the dashboard charts.
 *
 * The domain numbers come from `monthStats.ts`; the helpers here only decide
 * how many points to draw, which point is the maximum, and how tall a bar is.
 * They are pure so the windows and edge cases can be tested without a browser.
 */
import { maxDailyCount } from './monthStats'

export interface DailyPoint {
  /** Day of the month, 1-based. */
  day: number
  /** `null` after today, so the line stops instead of dropping to zero. */
  value: number | null
  /** True for the first highest elapsed day. No point is highlighted at zero. */
  isMax: boolean
}

/**
 * Turns a daily-count array into chart points.
 *
 * `startDay` is the day number of the first entry, which is not always 1: the
 * mobile chart shows a window near the end of the month.
 */
export function dailyPoints(
  counts: readonly (number | null)[],
  startDay = 1,
): DailyPoint[] {
  const highest = maxDailyCount(counts)
  const maxIndex = highest > 0 ? counts.findIndex((count) => count === highest) : -1

  return counts.map((value, index) => ({
    day: startDay + index,
    value,
    isMax: index === maxIndex,
  }))
}

export interface CountWindow {
  counts: (number | null)[]
  /** Day of the month for the first entry in `counts`. */
  startDay: number
}

/**
 * The last `size` elapsed days of a month.
 *
 * The window ends at `elapsed`, not at the end of the array, so a current month
 * never shows its future `null` days in the default mobile view. A past month
 * has every day elapsed, so it naturally becomes the last 14 days of that month.
 */
export function recentCountWindow(
  counts: readonly (number | null)[],
  elapsed: number,
  size = 14,
): CountWindow {
  const end = Math.min(Math.max(elapsed, 0), counts.length)
  const start = Math.max(0, end - Math.max(size, 0))

  return {
    counts: counts.slice(start, end),
    startDay: start + 1,
  }
}

/**
 * Bar height as a percentage of the tallest day.
 *
 * A checked day always gets at least 8%, otherwise one busy day would flatten a
 * quiet one to an invisible line. A zero or future day has no bar at all.
 */
export function barHeightPct(count: number | null, max: number): number {
  if (count === null || count <= 0 || max <= 0) {
    return 0
  }

  return Math.max(8, Math.round((count / max) * 100))
}

const ONE_DECIMAL = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Fixed one-decimal text for the ring centres, e.g. `61.9`. */
export function formatOneDecimal(value: number): string {
  return ONE_DECIMAL.format(value)
}
