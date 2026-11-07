/**
 * Habits: the only way in or out of the habits table.
 *
 * Components call these. They never touch the Supabase client directly, which is
 * what keeps the snake_case to camelCase mapping in one file and keeps every
 * query in the app visible by reading this one.
 *
 * Functions throw the underlying Supabase error. Callers turn it into something
 * readable with `databaseErrorMessage` from ./errors, so the wording lives at the
 * screen where it is shown and this file stays about data.
 */
import type { TablesInsert } from '@/lib/database.types'
import { getSupabaseClient } from '@/lib/supabase'
import type { Habit } from '@/types'

import {
  toHabit,
  toHabits,
  toHabitInsert,
  toHabitUpdate,
  type NewHabit,
  type HabitPatch,
} from './rows'

/** Cancels a realtime subscription. */
export type Unsubscribe = () => void

/**
 * This user's habits, in list order.
 *
 * `id` breaks ties in `sortOrder`, which makes the order total and therefore
 * stable across devices. Leaving it to Postgres would let two rows swap places
 * between fetches and show up as a grid that jitters.
 *
 * Archived habits are included. What counts towards a total is decided in
 * @/lib/stats, not by hiding rows here.
 */
export async function listHabits(): Promise<Habit[]> {
  const { data, error } = await getSupabaseClient()
    .from('habits')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error !== null) {
    throw error
  }

  return toHabits(data)
}

/**
 * Creates a habit and returns it as saved.
 *
 * No `user_id` is sent: a trigger on the table fills it from the session. RLS
 * rejects the insert if that trigger is missing, so the ownership rule cannot be
 * forgotten here and end up relying on the client to send the right id.
 */
export async function createHabit(habit: NewHabit): Promise<Habit> {
  const insert = toHabitInsert(habit)

  const { data, error } = await getSupabaseClient()
    .from('habits')
    // `set_row_user_id` supplies user_id from auth.uid() on insert, so the
    // payload correctly omits it. The generated Insert type still requires the
    // column; this is the one narrow cast at the client boundary.
    .insert(insert as TablesInsert<'habits'>)
    .select()
    .single()

  if (error !== null) {
    throw error
  }

  return toHabit(data)
}

/** Applies a patch and returns the habit as saved, including the new `updated_at`. */
export async function updateHabit(id: string, patch: HabitPatch): Promise<Habit> {
  const { data, error } = await getSupabaseClient()
    .from('habits')
    .update(toHabitUpdate(patch))
    .eq('id', id)
    .select()
    .single()

  if (error !== null) {
    throw error
  }

  return toHabit(data)
}

/**
 * Archives a habit rather than deleting it.
 *
 * The distinction is the product's: an archived habit keeps its history and stops
 * appearing in the tracker, totals and every percentage. `deleteHabit` is for
 * the case where the user really does want the history gone.
 */
export async function archiveHabit(id: string): Promise<Habit> {
  return updateHabit(id, { archived: true })
}

/** Undoes `archiveHabit`, bringing the habit back with its history intact. */
export async function unarchiveHabit(id: string): Promise<Habit> {
  return updateHabit(id, { archived: false })
}

/**
 * Deletes a habit and, by cascade, every check-in on it.
 *
 * Not undoable from the client. Say so before calling it.
 */
export async function deleteHabit(id: string): Promise<void> {
  const { error } = await getSupabaseClient().from('habits').delete().eq('id', id)

  if (error !== null) {
    throw error
  }
}

/**
 * Calls `onChange` whenever a habit changes on any device.
 *
 * `onChange` takes no row and re-reads the list instead of receiving a diff. A
 * habit change can move check-ins between totals, the grid and the percentages
 * all at once, and the alternative is a diff applier in every caller that has to
 * agree with @/lib/stats. One refetch on a change nobody makes by hand costs
 * nothing and cannot disagree with itself.
 *
 * RLS applies to realtime as well as to queries, so events only ever arrive for
 * this user's habits. There is no filter to add and none should be added on the
 * assumption that events arrive unfiltered.
 */
export function subscribeToHabits(onChange: () => void): Unsubscribe {
  const client = getSupabaseClient()
  const channel = client
    .channel('habits')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, onChange)
    .subscribe()

  return () => {
    void client.removeChannel(channel)
  }
}
