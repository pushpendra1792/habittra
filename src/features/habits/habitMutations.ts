/**
 * Writing habits: add, edit, archive, restore and reorder.
 *
 * Every mutation writes optimistically first, then tries the normal Supabase
 * call. A permanent rule violation still throws and rolls the cache back. A
 * network or auth failure is queued instead, so an edit made on a train does
 * not disappear and is replayed in order when the connection returns.
 *
 * The queue operations carry the client-generated habit id. A create is an
 * upsert on that id, so a response lost after the row landed can be replayed
 * without creating a second habit. Reorder is several `update_habit` operations;
 * they are idempotent sort-order patches, and the queued order is the order the
 * user dragged the rows into.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useSync } from '@/features/sync/useSync'
import { databaseErrorMessage } from '@/lib/api/errors'
import { createHabit, updateHabit } from '@/lib/api/habitsApi'
import type { HabitPatch } from '@/lib/api/rows'
import type { CreateHabitOperation, SyncOperation, UpdateHabitOperation } from '@/lib/sync/types'
import { writeOrQueue } from '@/lib/sync/write'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Habit } from '@/types'

import { habitListKey } from '@/features/tracker/trackerQueries'
import {
  nextSortOrder,
  patchHabitInList,
  planReorder,
  reorderHabits,
  upsertHabitInList,
  type SortOrderWrite,
} from './habitList'

export interface NewHabitInput {
  name: string
  monthlyGoal: number
  color: Habit['color']
}

interface EditVariables {
  id: string
  patch: HabitPatch
}

interface RestoreVariables {
  id: string
  sortOrder: number
}

interface ReorderVariables {
  orderedIds: string[]
  writes: SortOrderWrite[]
}

interface HabitMutationContext {
  previous: Habit[]
}

export interface HabitMutations {
  /**
   * Adds a habit at the end of the list. Resolves `true` once the write has
   * landed or been queued, and `false` when a permanent failure was reported.
   */
  add: (input: NewHabitInput) => Promise<boolean>
  /** Applies a patch to one habit: name, goal or colour. Same resolution rule. */
  edit: (id: string, patch: HabitPatch) => Promise<boolean>
  /** Archives one habit. Its history stays. Resolves as `add` does. */
  archive: (id: string) => Promise<boolean>
  /** Brings an archived habit back, at the end of the list. */
  restore: (id: string) => void
  /** Moves the active habits into a new order. */
  reorder: (orderedIds: string[]) => void
  /** True while any of the above is in flight, for a disabled Save button. */
  isSaving: boolean
}

function operationBase(userId: string) {
  return {
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  }
}

export function useHabitMutations(): HabitMutations {
  const queryClient = useQueryClient()
  const { push } = useToast()
  const { userId } = useAuth()
  const { enqueue } = useSync()

  const actor = userId ?? ''
  const isOnline = () => navigator.onLine

  const report = (error: unknown, fallback: string) => {
    push({ message: databaseErrorMessage(error, fallback) })
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: habitListKey })
  }

  const cachedHabits = () => queryClient.getQueryData<Habit[]>(habitListKey) ?? []

  const addMutation = useMutation({
    mutationFn: (habit: Habit) => {
      const operation: CreateHabitOperation = {
        ...operationBase(actor),
        kind: 'create_habit',
        habit: {
          id: habit.id,
          name: habit.name,
          monthlyGoal: habit.monthlyGoal,
          color: habit.color,
          sortOrder: habit.sortOrder,
        },
      }

      return writeOrQueue({
        write: () =>
          createHabit({
            id: habit.id,
            name: habit.name,
            monthlyGoal: habit.monthlyGoal,
            color: habit.color,
            sortOrder: habit.sortOrder,
          }),
        enqueue: () => enqueue(operation),
        isOnline,
      })
    },
    onMutate: async (habit): Promise<HabitMutationContext> => {
      await queryClient.cancelQueries({ queryKey: habitListKey })

      const previous = queryClient.getQueryData<Habit[]>(habitListKey) ?? []

      queryClient.setQueryData<Habit[]>(habitListKey, (current) =>
        upsertHabitInList(current ?? previous, habit),
      )

      return { previous }
    },
    onError: (error, _habit, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(habitListKey, context.previous)
      }

      report(error, 'Could not add that habit.')
    },
    onSettled: invalidate,
  })

  const editMutation = useMutation({
    mutationFn: ({ id, patch }: EditVariables) => {
      const operation: UpdateHabitOperation = {
        ...operationBase(actor),
        kind: 'update_habit',
        habitId: id,
        patch,
      }

      return writeOrQueue({
        write: () => updateHabit(id, patch),
        enqueue: () => enqueue(operation),
        isOnline,
      })
    },
    onMutate: async ({ id, patch }): Promise<HabitMutationContext> => {
      await queryClient.cancelQueries({ queryKey: habitListKey })

      const previous = queryClient.getQueryData<Habit[]>(habitListKey) ?? []

      queryClient.setQueryData<Habit[]>(habitListKey, (current) =>
        patchHabitInList(current ?? previous, id, patch),
      )

      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(habitListKey, context.previous)
      }

      report(error, 'Could not save that habit.')
    },
    onSettled: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => {
      const patch: HabitPatch = { archived: true }
      const operation: UpdateHabitOperation = {
        ...operationBase(actor),
        kind: 'update_habit',
        habitId: id,
        patch,
      }

      return writeOrQueue({
        write: () => updateHabit(id, patch),
        enqueue: () => enqueue(operation),
        isOnline,
      })
    },
    onMutate: async (id): Promise<HabitMutationContext> => {
      await queryClient.cancelQueries({ queryKey: habitListKey })

      const previous = queryClient.getQueryData<Habit[]>(habitListKey) ?? []

      queryClient.setQueryData<Habit[]>(habitListKey, (current) =>
        patchHabitInList(current ?? previous, id, { archived: true }),
      )

      return { previous }
    },
    onError: (error, _id, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(habitListKey, context.previous)
      }

      report(error, 'Could not archive that habit.')
    },
    onSettled: invalidate,
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, sortOrder }: RestoreVariables) => {
      const patch: HabitPatch = { archived: false, sortOrder }
      const operation: UpdateHabitOperation = {
        ...operationBase(actor),
        kind: 'update_habit',
        habitId: id,
        patch,
      }

      return writeOrQueue({
        write: () => updateHabit(id, patch),
        enqueue: () => enqueue(operation),
        isOnline,
      })
    },
    onMutate: async ({ id, sortOrder }): Promise<HabitMutationContext> => {
      await queryClient.cancelQueries({ queryKey: habitListKey })

      const previous = queryClient.getQueryData<Habit[]>(habitListKey) ?? []

      queryClient.setQueryData<Habit[]>(habitListKey, (current) =>
        patchHabitInList(current ?? previous, id, { archived: false, sortOrder }),
      )

      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(habitListKey, context.previous)
      }

      report(error, 'Could not bring that habit back.')
    },
    onSettled: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: (variables: ReorderVariables) => {
      const operations: SyncOperation[] = variables.writes.map((write) => ({
        ...operationBase(actor),
        kind: 'update_habit',
        habitId: write.id,
        patch: { sortOrder: write.sortOrder },
      }))

      return writeOrQueue({
        write: () =>
          Promise.all(
            variables.writes.map((write) => updateHabit(write.id, { sortOrder: write.sortOrder })),
          ),
        enqueue: async () => {
          for (const operation of operations) {
            await enqueue(operation)
          }
        },
        isOnline,
      })
    },
    onMutate: async (variables: ReorderVariables): Promise<HabitMutationContext> => {
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
    add: async (input) => {
      const habits = cachedHabits()
      const habit: Habit = {
        id: crypto.randomUUID(),
        userId: actor,
        name: input.name.trim(),
        monthlyGoal: input.monthlyGoal,
        color: input.color,
        sortOrder: nextSortOrder(habits),
        archived: false,
        createdAt: new Date().toISOString(),
      }

      try {
        await addMutation.mutateAsync(habit)
        return true
      } catch {
        // onError has already said what went wrong; this is only the answer to
        // "did it work", so the caller can close its form or keep the text.
        return false
      }
    },
    edit: async (id, patch) => {
      try {
        await editMutation.mutateAsync({ id, patch })
        return true
      } catch {
        return false
      }
    },
    archive: async (id) => {
      try {
        await archiveMutation.mutateAsync(id)
        return true
      } catch {
        return false
      }
    },
    restore: (id) => {
      restoreMutation.mutate({ id, sortOrder: nextSortOrder(cachedHabits()) })
    },
    reorder: (orderedIds) => {
      reorderMutation.mutate({ orderedIds, writes: planReorder(cachedHabits(), orderedIds) })
    },
    isSaving:
      addMutation.isPending ||
      editMutation.isPending ||
      archiveMutation.isPending ||
      restoreMutation.isPending ||
      reorderMutation.isPending,
  }
}
