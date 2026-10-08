/**
 * Tapping a cell: optimistic, and reversible.
 *
 * The order of operations is the whole design. `onMutate` runs before the
 * write, so the cell changes on the first frame rather than on the round trip.
 * It first cancels any refetch in flight and remembers the list it is about to
 * change; if the write then fails, `onError` puts that list straight back and
 * the user sees the cell return to where it was, with a toast saying why.
 * `onSettled` refetches from the server either way, because the server is the
 * only thing that knows what actually happened.
 *
 * The write itself carries a client-generated id and is an upsert on
 * `(habit_id, date)`, so the same tap replayed later is the same row and cannot
 * produce a duplicate. That is what Phase 6's offline queue will lean on.
 *
 * Components call `useToggleCheckin().toggle`. Nothing here touches Supabase
 * except through `@/lib/api`.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { databaseErrorMessage } from '@/lib/api/errors'
import { checkIn, undoCheckin } from '@/lib/api/checkinsApi'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import type { Checkin, DateString, MonthKey } from '@/types'

import { applyCheckinToggle } from './checkinCache'
import { checkinsKey } from './trackerQueries'

export interface ToggleCheckinVars {
  habitId: string
  date: DateString
  /** The state the cell is moving to. */
  next: boolean
  /** Generated once, when the tap happens, and reused by every retry. */
  id: string
}

export interface ToggleCheckinContext {
  /** The month's check-ins as they were before the optimistic write. */
  previous: Checkin[]
}

export interface ToggleCheckinOptions {
  monthKey: MonthKey
  /** Fills in `userId` on an optimistically added row. */
  userId: string
  queryClient: QueryClient
  /** Called once per failure, after the cache has been rolled back. */
  onRollback: (error: unknown) => void
}

export interface ToggleCheckinMutation {
  mutationFn: (variables: ToggleCheckinVars) => Promise<void>
  onMutate: (variables: ToggleCheckinVars) => Promise<ToggleCheckinContext>
  onError: (
    error: unknown,
    variables: ToggleCheckinVars,
    context: ToggleCheckinContext | undefined,
  ) => void
  onSettled: (
    data: unknown,
    error: unknown,
    variables: ToggleCheckinVars,
    context: ToggleCheckinContext | undefined,
  ) => void
}

/**
 * The mutation's four handlers, built from their dependencies and returned so
 * they can be exercised directly in a test with a real `QueryClient` and no
 * network. The hook below is only the wiring.
 */
export function toggleCheckinMutation({
  monthKey,
  userId,
  queryClient,
  onRollback,
}: ToggleCheckinOptions): ToggleCheckinMutation {
  const key = checkinsKey(monthKey)

  return {
    mutationFn: async (variables) => {
      if (variables.next) {
        await checkIn(variables.habitId, variables.date, variables.id)
      } else {
        await undoCheckin(variables.habitId, variables.date)
      }
    },

    onMutate: async (variables) => {
      // A refetch that lands after this write would put the old list back over
      // the cell the user just tapped, so it is cancelled first.
      await queryClient.cancelQueries({ queryKey: key })

      const previous = queryClient.getQueryData<Checkin[]>(key) ?? []

      queryClient.setQueryData<Checkin[]>(key, (current) =>
        applyCheckinToggle(current ?? previous, {
          habitId: variables.habitId,
          date: variables.date,
          next: variables.next,
          id: variables.id,
          userId,
          createdAt: new Date().toISOString(),
        }),
      )

      return { previous }
    },

    onError: (error, _variables, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(key, context.previous)
      }

      onRollback(error)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  }
}

/**
 * Toggle one cell for the month on screen.
 *
 * The id is generated here rather than in the component: a tap is one logical
 * request, and it must keep one identity whether it is sent now or queued and
 * replayed later.
 */
export function useToggleCheckin(monthKey: MonthKey): {
  toggle: (habitId: string, date: DateString, next: boolean) => void
} {
  const { userId } = useAuth()
  const { push } = useToast()
  const queryClient = useQueryClient()

  const { mutate } = useMutation(
    toggleCheckinMutation({
      monthKey,
      userId: userId ?? '',
      queryClient,
      onRollback: (error) => {
        push({ message: databaseErrorMessage(error, 'Could not save that check-in.') })
      },
    }),
  )

  return {
    toggle: (habitId, date, next) => {
      mutate({ habitId, date, next, id: crypto.randomUUID() })
    },
  }
}
