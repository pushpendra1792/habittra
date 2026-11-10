import { describe, expect, it } from 'vitest'

import { checkinsCacheKey, habitsCacheKey, monthFromCheckinsCacheKey, syncQueueKey } from './keys'

describe('cache keys', () => {
  it('scopes habits to one user', () => {
    expect(habitsCacheKey('user-a')).not.toBe(habitsCacheKey('user-b'))
    expect(habitsCacheKey('user-a')).toBe('user:user-a:habits')
  })

  it('scopes a month to both the user and the month', () => {
    expect(checkinsCacheKey('user-a', '2026-10')).not.toBe(checkinsCacheKey('user-b', '2026-10'))
    expect(checkinsCacheKey('user-a', '2026-10')).not.toBe(checkinsCacheKey('user-a', '2026-11'))
    expect(checkinsCacheKey('user-a', '2026-10')).toBe('user:user-a:checkins:2026-10')
  })

  it('scopes the queue to one user', () => {
    expect(syncQueueKey('user-a')).not.toBe(syncQueueKey('user-b'))
    expect(syncQueueKey('user-a')).toBe('user:user-a:sync')
  })

  it('reads the month back from a check-ins key', () => {
    expect(monthFromCheckinsCacheKey(checkinsCacheKey('user-a', '2026-10'))).toBe('2026-10')
  })

  it('returns null for a key that is not a cached month', () => {
    expect(monthFromCheckinsCacheKey(habitsCacheKey('user-a'))).toBeNull()
    expect(monthFromCheckinsCacheKey('user:user-a:checkins:not-a-month')).toBeNull()
  })
})
