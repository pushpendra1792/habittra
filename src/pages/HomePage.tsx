/**
 * The tracker and dashboard screen: the month, the summary, the grid, and the
 * two ways into managing habits.
 *
 * This is the only place that reads data. `useMonthStats` reads the same
 * TanStack Query cache entries the grid uses, so a check-in updates the grid,
 * the counters and every ring in the same render. Components below this page
 * receive plain numbers and rows; none of them fetches or computes a stat.
 */
import { lazy, Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { MonthInfoCard } from '@/features/dashboard/MonthInfoCard'
import { ProgressRings } from '@/features/dashboard/ProgressRings'
import { SuccessRateCard } from '@/features/dashboard/SuccessRateCard'
import { useMonthStats } from '@/features/dashboard/useMonthStats'
import { HabitManagerModal } from '@/features/habits/HabitManagerModal'
import { activeHabits } from '@/features/habits/habitList'
import { MonthSwitcher } from '@/features/tracker/MonthSwitcher'
import { TrackerPanel } from '@/features/tracker/TrackerPanel'
import { currentMonthKey, parseMonthParam } from '@/features/tracker/monthParam'
import { useToggleCheckin } from '@/features/tracker/useToggleCheckin'

// Recharts is the heaviest dependency on this screen, so only the chart chunk
// loads it. The tracker and the rest of the dashboard paint without waiting.
const DailyCompletionChart = lazy(() => import('@/features/dashboard/DailyCompletionChart'))

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

/** Holds the chart's cell while the lazy Recharts chunk arrives. */
function ChartSkeleton() {
  return (
    <Card className="order-3 flex h-full flex-col gap-3 md:order-none md:col-start-2 md:row-start-1">
      <Skeleton width={140} height={16} />
      <Skeleton height={220} />
    </Card>
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

  const monthStats = useMonthStats(monthKey)
  const { habits, checkins, today, isPending, isError, retry } = monthStats
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

  const tracker = isPending ? (
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
      monthTotals={monthStats.totals}
      dailyCounts={monthStats.dailyCounts}
      maxDailyCount={monthStats.maxDailyCount}
      onToggle={toggle}
      onAddHabit={() => {
        openManager('add')
      }}
    />
  )

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

        {isPending || isError ? (
          <Card tone="light" flush>
            {tracker}
          </Card>
        ) : (
          <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(8.5rem,10rem)_minmax(0,1fr)_minmax(10rem,12rem)] md:grid-rows-[auto_auto_auto] md:gap-4">
            {monthStats.hasActiveHabits ? (
              <>
                <SuccessRateCard
                  successRatePct={monthStats.successRatePct}
                  successMessage={monthStats.successMessage}
                  isFuture={monthStats.isFuture}
                  className="order-1 min-w-0 md:order-none md:col-start-3 md:row-start-1"
                />

                <ProgressRings
                  monthlyProgressPct={monthStats.monthlyProgressPct}
                  normalizedProgressPct={monthStats.normalizedProgressPct}
                  momentumPct={monthStats.momentumPct}
                  isFuture={monthStats.isFuture}
                  className="order-2 min-w-0 md:order-none md:col-span-3 md:row-start-3"
                />

                {monthStats.isFuture ? (
                  <Card className="order-3 flex min-h-56 items-center justify-center md:order-none md:col-start-2 md:row-start-1">
                    <p className="text-center text-sm text-text-muted-on-dark">
                      This month has not started yet.
                    </p>
                  </Card>
                ) : (
                  <Suspense fallback={<ChartSkeleton />}>
                    <DailyCompletionChart
                      dailyCounts={monthStats.dailyCounts}
                      maxDailyCount={monthStats.maxDailyCount}
                      elapsedDays={monthStats.elapsedDays}
                      daysInMonth={monthStats.daysInMonth}
                      totals={monthStats.totals}
                      monthKey={monthKey}
                      className="order-3 h-full min-w-0 md:order-none md:col-start-2 md:row-start-1"
                    />
                  </Suspense>
                )}

                <MonthInfoCard
                  stats={monthStats}
                  className="hidden h-full min-w-0 md:order-none md:col-start-1 md:row-start-1 md:block"
                />
              </>
            ) : (
              <Card className="order-1 min-w-0 md:order-none md:col-span-3 md:row-start-1">
                <p className="text-sm font-medium">No habits to summarise yet.</p>
                <p className="mt-1 text-xs text-text-muted-on-dark">
                  Add one below to start this month.
                </p>
              </Card>
            )}

            <Card
              tone="light"
              flush
              className="order-4 min-w-0 md:order-none md:col-span-3 md:row-start-2"
            >
              {tracker}
            </Card>
          </div>
        )}
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
