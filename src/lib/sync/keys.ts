/**
 * Cache keys.
 *
 * Every key starts with the user id. A shared browser can hold two accounts'
 * cached months at once, and neither can accidentally read the other's rows by
 * asking for a month or a habit list without saying who is asking.
 */
import type { MonthKey } from '@/types'

const PREFIX = 'user'

/** One habits record per user. */
export function habitsCacheKey(userId: string): string {
  return `${PREFIX}:${userId}:habits`
}

/** One check-ins record per user and month. */
export function checkinsCacheKey(userId: string, monthKey: MonthKey): string {
  return `${PREFIX}:${userId}:checkins:${monthKey}`
}

/** The queue and failed list for one user. */
export function syncQueueKey(userId: string): string {
  return `${PREFIX}:${userId}:sync`
}

/** The month encoded in a check-ins cache key, or null for another kind of key. */
export function monthFromCheckinsCacheKey(key: string): MonthKey | null {
  const match = /^user:.+:checkins:(\d{4}-\d{2})$/.exec(key)

  return match?.[1] === undefined ? null : (match[1] as MonthKey)
}
