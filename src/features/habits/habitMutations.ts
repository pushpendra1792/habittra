/**
 * Writing habits: add, edit, archive, restore and reorder.
 *
 * Everything goes through `@/lib/api`, and every change ends with the habit
 * list being refetched, so one code path decides what the tracker shows rather
 * than each screen guessing at what the server did.
 *
 * Reorder is the one exception: a drag that waits for a round trip before the
 * rows move feels broken, so it writes to the cache first and rolls back if the
 * write fails. The plan of what to write is worked out before the cache moves,
 * while the list still says what the server says.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { archiveHabit, createHabit, updateHabit } from '@/lib/api/habitsApi'
import type { HabitPatch } from '@/lib/api/rows'
import { databaseErrorMessage } from '@/lib/api/errors'
import { useToast } from '@/hooks/useToast'
import type { Habit } from '@/types'

import { nextSortOrder, planReorder, reorderHabits, type SortOrderWrite } from './habitList'
import { habitListKey } from '@/features/tracker/trackerQueries'

export interface NewHabitInput {
  name: string
  monthlyGoal: number
  color: Habit['color']
}

interface ReorderVariables {
  orderedIds: string[]
  writes: SortOrderWrite[]
}

interface ReorderContext {
  previous: Habit[]
}

export interface HabitMutations {
  /** Adds a habit at the end of the list. */
  add: (input: NewHabitInput) => void
  /** Applies a patch to one habit: name, goal or colour. */
  edit: (id: string, patch: HabitPatch) => void
  /** Archives one habit. Its history stays. */
  archive: (id: string) => void
  /** Brings an archived habit back, at the end of the list. */
  restore: (id: string) => void
  /** Moves the active habits into a new order. */
  reorder: (orderedIds: string[]) => void
  /** True while any of the above is in flight, for a disabled Save button. */
  isSaving: boolean
}

export function useHabitMutations(): HabitMutations {
  const queryClient = useQueryClient()
  const { push } = useToast()

  const report = (error: unknown, fallback: string) => {
    push({ message: databaseErrorMessage(error, fallback) })
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: habitListKey })
  }

  const cachedHabits = () => queryClient.getQueryData<Habit[]>(habitListKey) ?? []

  const add = useMutation({
    mutationFn: (input: NewHabitInput & { sortOrder: number }) => createHabit(input),
    onSuccess: invalidate,
    onError: (error) => {
      report(error, 'Could not add that habit.')
    },
  })

  const edit = useMutation({
    mutationFn: (variables: { id: string; patch: HabitPatch }) =>
      updateHabit(variables.id, variables.patch),
    onSuccess: invalidate,
    onError: (error) => {
      report(error, 'Could not save that habit.')
    },
  })

  const archive = useMutation({
    mutationFn: (id: string) => archiveHabit(id),
    onSuccess: invalidate,
    onError: (error) => {
      report(error, 'Could not archive that habit.')
    },
  })

  const restore = useMutation({
    mutationFn: (variables: { id: string; sortOrder: number }) =>
      updateHabit(variables.id, { archived: false, sortOrder: variables.sortOrder }),
    onSuccess: invalidate,
    onError: (error) => {
      report(error, 'Could not bring that habit back.')
    },
  })

  const reorder = useMutation({
    mutationFn: async (variables: ReorderVariables) => {
      await Promise.all(
        variables.writes.map((write) => updateHabit(write.id, { sortOrder: write.sortOrder })),
      )
    },
    onMutate: async (variables: ReorderVariables): Promise<ReorderContext> => {
      await queryClient.cancelQueries({ queryKey: habitListKey })

      const previous = queryClient.getQueryData<Habit[]>(habitListKey) ?? []

      queryClient.setQueryData<Habit[]>(habitListKey, (current) =>
        reorderHabits(current ?? previous, variables.orderedIds),
      )

      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(habitListKey, context.previous)
      }

      report(error, 'Could not save the new order.')
    },
    onSettled: invalidate,
  })

  return {
    add: (input) => {
      add.mutate({ ...input, sortOrder: nextSortOrder(cachedHabits()) })
    },
    edit: (id, patch) => {
      edit.mutate({ id, patch })
    },
    archive: (id) => {
      archive.mutate(id)
    },
    restore: (id) => {
      restore.mutate({ id, sortOrder: nextSortOrder(cachedHabits()) })
    },
    reorder: (orderedIds) => {
      reorder.mutate({ orderedIds, writes: planReorder(cachedHabits(), orderedIds) })
    },
    isSaving:
      add.isPending ||
      edit.isPending ||
      archive.isPending ||
      restore.isPending ||
      reorder.isPending,
  }
}
