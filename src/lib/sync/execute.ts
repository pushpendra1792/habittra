/**
 * One queue operation, sent through the existing API layer.
 *
 * This is the only place that maps a queue kind to a Supabase call. The API
 * functions keep their idempotent shapes: check-ins use the unique
 * `(habit_id, date)` upsert, deletes are harmless when the row is already gone,
 * habit creates upsert on the client-generated id, and updates are natural
 * idempotent patches.
 */
import { checkIn, undoCheckin } from '@/lib/api/checkinsApi'
import { createHabit, updateHabit } from '@/lib/api/habitsApi'

import type { SyncOperation } from './types'

export async function executeSyncOperation(operation: SyncOperation): Promise<void> {
  switch (operation.kind) {
    case 'add_checkin':
      await checkIn(operation.habitId, operation.date, operation.checkinId)
      return
    case 'remove_checkin':
      await undoCheckin(operation.habitId, operation.date)
      return
    case 'create_habit':
      await createHabit(operation.habit)
      return
    case 'update_habit':
      await updateHabit(operation.habitId, operation.patch)
  }
}
