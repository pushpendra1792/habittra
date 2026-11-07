/**
 * The tracker screen: the month, the grid, and the two ways into managing
 * habits.
 *
 * This is the only place that reads data. It asks the query hooks for habits
 * and check-ins, works out the month's totals with `@/lib/stats`, and hands
 * plain values to `TrackerPanel`, which is a presentational component with no
 * idea where any of it came from. Splitting it here is what lets Phase 6 put a
 * sync layer underneath without touching the grid.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMonthStats } from '@/features/dashboard/useMonthStats'
import { HabitManagerModal } from '@/features/habits/HabitManagerModal'
import { activeHabits } from '@/features/habits/habitList'
import { MonthSwitcher } from '@/features/tracker/MonthSwitcher'
import { TrackerPanel } from '@/features/tracker/TrackerPanel'
import { currentMonthKey, parseMonthParam } from '@/features/tracker/monthParam'
import { useToggleCheckin } from '@/features/tracker/useToggleCheckin'

/** The grid's shape while it loads: a header band and four habit rows. */
function TrackerSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex h-12 items-center gap-4 border-b border-border-light px-3 md:px-4">
        <Skeleton width={110} height={12} tone="light" />
        <Skeleton width={36} height={36} tone="light" />
        <Skeleton width={36} height={36} tone="light" />
        <Skeleton width={36} height={36} tone="light" />
      </div>

      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex h-12 items-center gap-4 border-b border-border-light/60 px-3 md:px-4"
        >
          <Skeleton width={140} height={14} tone="light" />
          <Skeleton width={36} height={36} tone="light" />
          <Skeleton width={36} height={36} tone="light" />
          <Skeleton width={36} height={36} tone="light" />
        </div>
      ))}
    </div>
  )
}

function PanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm font-medium">Could not load the tracker.</p>
      <p className="text-xs text-text-on-light/60">
        The server did not answer. Nothing has been lost.
      </p>
      <Button variant="primary" className="mt-1" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const monthKey = parseMonthParam(searchParams.get('m'), currentMonthKey())

  const {
    habits,
    checkins,
    today,
    totals: monthTotals,
    dailyCounts,
    maxDailyCount,
    isPending,
    isError,
    retry,
  } = useMonthStats(monthKey)
  const { toggle } = useToggleCheckin(monthKey)

  // Kept after closing so the dialog's title does not change underneath the
  // fade-out, and so the next open starts on the view it was asked for.
  const [managerView, setManagerView] = useState<'list' | 'add'>('list')
  const [managerOpen, setManagerOpen] = useState(false)

  const active = useMemo(() => activeHabits(habits), [habits])

  const openManager = (view: 'list' | 'add') => {
    setManagerView(view)
    setManagerOpen(true)
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-4 sm:gap-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthSwitcher
            monthKey={monthKey}
            isCurrentMonth={monthKey === currentMonthKey()}
            onChange={(next) => {
              setSearchParams({ m: next })
            }}
            onToday={() => {
              setSearchParams({ m: currentMonthKey() })
            }}
          />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              openManager('list')
            }}
          >
            Manage habits
          </Button>
        </div>

        <Card tone="light" flush>
          {isPending ? (
            <TrackerSkeleton />
          ) : isError ? (
            <PanelError onRetry={retry} />
          ) : (
            <TrackerPanel
              key={monthKey}
              habits={active}
              checkins={checkins}
              monthKey={monthKey}
              today={today}
              monthTotals={monthTotals}
              dailyCounts={dailyCounts}
              maxDailyCount={maxDailyCount}
              onToggle={toggle}
              onAddHabit={() => {
                openManager('add')
              }}
            />
          )}
        </Card>
      </main>

      <HabitManagerModal
        open={managerOpen}
        initialView={managerView}
        habits={habits}
        onClose={() => {
          setManagerOpen(false)
        }}
      />
    </div>
  )
}
