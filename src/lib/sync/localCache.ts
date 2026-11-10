/**
 * The IndexedDB half of offline support.
 *
 * Two stores:
 *   cache  habits and one month of check-ins per record, keyed by user id
 *   sync   the pending and failed queue for one user
 *
 * The functions here are deliberately small and data-only. Query hydration is
 * in `features/tracker/localCacheSync.ts`, because that is where the TanStack
 * Query keys live.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

import type { Checkin, Habit, MonthKey } from '@/types'

import { checkinsCacheKey, habitsCacheKey } from './keys'
import { emptySyncSnapshot, type SyncSnapshot } from './types'

const DB_NAME = 'habittra-local'
const DB_VERSION = 1

interface HabitsCacheRecord {
  key: string
  userId: string
  kind: 'habits'
  data: Habit[]
  updatedAt: number
}

interface CheckinsCacheRecord {
  key: string
  userId: string
  kind: 'checkins'
  monthKey: MonthKey
  data: Checkin[]
  updatedAt: number
}

type CacheRecord = HabitsCacheRecord | CheckinsCacheRecord

interface SyncRecord extends SyncSnapshot {
  userId: string
  updatedAt: number
}

interface HabittraLocalDb extends DBSchema {
  cache: {
    key: string
    value: CacheRecord
    indexes: { 'by-user': string }
  }
  sync: {
    key: string
    value: SyncRecord
  }
}

let databasePromise: Promise<IDBPDatabase<HabittraLocalDb>> | null = null

function database(): Promise<IDBPDatabase<HabittraLocalDb>> {
  databasePromise ??= openDB<HabittraLocalDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const cache = db.createObjectStore('cache', { keyPath: 'key' })
      cache.createIndex('by-user', 'userId')
      db.createObjectStore('sync', { keyPath: 'userId' })
    },
  })

  return databasePromise
}

/** This user's saved habit list, or null when nothing has been cached yet. */
export async function readCachedHabits(userId: string): Promise<Habit[] | null> {
  const db = await database()
  const record = await db.get('cache', habitsCacheKey(userId))

  return record?.kind === 'habits' ? record.data : null
}

/** Saves the habit list for one user. */
export async function writeCachedHabits(userId: string, habits: readonly Habit[]): Promise<void> {
  const db = await database()

  await db.put('cache', {
    key: habitsCacheKey(userId),
    userId,
    kind: 'habits',
    data: [...habits],
    updatedAt: Date.now(),
  })
}

/** This user's saved check-ins for one month, or null when that month is uncached. */
export async function readCachedCheckins(
  userId: string,
  monthKey: MonthKey,
): Promise<Checkin[] | null> {
  const db = await database()
  const record = await db.get('cache', checkinsCacheKey(userId, monthKey))

  return record?.kind === 'checkins' ? record.data : null
}

/** Saves one month of check-ins for one user. */
export async function writeCachedCheckins(
  userId: string,
  monthKey: MonthKey,
  checkins: readonly Checkin[],
): Promise<void> {
  const db = await database()

  await db.put('cache', {
    key: checkinsCacheKey(userId, monthKey),
    userId,
    kind: 'checkins',
    monthKey,
    data: [...checkins],
    updatedAt: Date.now(),
  })
}

/** Every cached month for one user. Used once at startup to fill the query cache. */
export async function readAllCachedCheckins(
  userId: string,
): Promise<{ monthKey: MonthKey; checkins: Checkin[] }[]> {
  const db = await database()
  const records = await db.getAllFromIndex('cache', 'by-user', userId)

  return records.flatMap((record) =>
    record.kind === 'checkins' ? [{ monthKey: record.monthKey, checkins: record.data }] : [],
  )
}

/** The pending/failed queue for one user. */
export async function readSyncSnapshot(userId: string): Promise<SyncSnapshot> {
  const db = await database()
  const record = await db.get('sync', userId)

  if (record === undefined) {
    return emptySyncSnapshot()
  }

  return { pending: record.pending, failed: record.failed }
}

/** Replaces the pending/failed queue for one user. */
export async function writeSyncSnapshot(userId: string, snapshot: SyncSnapshot): Promise<void> {
  const db = await database()

  await db.put('sync', {
    userId,
    pending: snapshot.pending,
    failed: snapshot.failed,
    updatedAt: Date.now(),
  })
}

/**
 * Removes every cached habit, month and queued operation.
 *
 * Called on sign-out. It clears all local accounts rather than only the one
 * signing out: the browser is shared, and leaving an old account's rows behind
 * for a later sign-in is the privacy mistake this keying is meant to prevent.
 */
export async function clearLocalData(): Promise<void> {
  const db = await database()
  const transaction = db.transaction(['cache', 'sync'], 'readwrite')

  await Promise.all([
    transaction.objectStore('cache').clear(),
    transaction.objectStore('sync').clear(),
    transaction.done,
  ])
}
