/**
 * The month grid: one row per habit, one column per day, a total underneath.
 *
 * The screen holds no numbers of its own. Completion counts, percentages and
 * the month's totals are computed by `@/lib/stats` in the page that renders
 * this, so what the grid prints and what the rest of the app prints cannot
 * drift apart. What lives here is layout, focus handling and the tap wiring.
 *
 * Two decisions shape the markup. The grid is one flex row per habit rather
 * than a real table, because the left column has to be sticky while the days
 * scroll under it and a table cannot do that without more wrappers than it is
 * worth; every cell carries a full accessible name instead, so it still reads
 * as "Morning run, 4 October 2026, done". And the column widths are fixed, so
 * a cell is the same object on a phone and on a desktop.
 */
import { useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { CheckCell } from '@/components/ui/CheckCell'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { habitCompleted, habitProgressPct, type Totals } from '@/lib/stats'
import type { Checkin, DateString, Habit, MonthKey } from '@/types'

import { columnWash } from './columnWash'
import { defaultAnchor, findFocusableCell, type Cell, type CellDirection } from './focusGrid'
import { monthDays } from './monthDays'

/** Habit name and goal on the left, sticky while the days scroll. */
const LEFT_CELL = 'w-38 shrink-0 md:w-50'
/** Per-habit progress on the right, wide screens only. */
const RIGHT_CELL = 'ml-auto hidden w-35 shrink-0 items-center px-4 md:flex'
const DAY_COLUMN = 'w-9 shrink-0'

const ARROW_TO_DIRECTION: Record<string, CellDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

interface GridCell {
  /** The wrapper the button sits in, which is what carries the coordinates. */
  element: HTMLElement
  row: number
  col: number
}

/** Walks up from a focused button to its cell wrapper, or gives up. */
function cellFrom(target: EventTarget | null): GridCell | null {
  if (!(target instanceof Element)) {
    return null
  }

  const element = target.closest<HTMLElement>('[data-cell]')

  if (element === null) {
    return null
  }

  const row = Number(element.dataset['row'])
  const col = Number(element.dataset['col'])

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return null
  }

  return { element, row, col }
}

export interface TrackerPanelProps {
  /** Active habits, in list order. */
  habits: readonly Habit[]
  checkins: readonly Checkin[]
  monthKey: MonthKey
  today: DateString
  /** The month's totals, from `totals()` in the page. */
  monthTotals: Totals
  /** Writes one cell. Optimistic, with rollback on failure. */
  onToggle: (habitId: string, date: DateString, next: boolean) => void
  onAddHabit: () => void
}

export function TrackerPanel({
  habits,
  checkins,
  monthKey,
  today,
  monthTotals,
  onToggle,
  onAddHabit,
}: TrackerPanelProps) {
  const days = useMemo(() => monthDays(monthKey), [monthKey])
  const dates = useMemo(() => days.map((day) => day.date), [days])

  // Membership of the set is the only question each cell asks, so the month's
  // check-ins are flattened to `habit|date` keys once rather than scanned per
  // cell: 15 habits by 31 days would otherwise be 465 walks of the list.
  const checked = useMemo(
    () => new Set(checkins.map((checkin) => `${checkin.habitId}|${checkin.date}`)),
    [checkins],
  )

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<Cell>(() => defaultAnchor(dates, today))

  // Open on today. The panel is remounted per month, so this runs once per
  // month on screen and never fights a scroll the user has since made.
  useEffect(() => {
    const container = scrollRef.current
    const todayCell = container?.querySelector<HTMLElement>('[data-today]') ?? null

    if (container === null || todayCell === null) {
      return
    }

    // Measured rather than assumed: the sticky column is wider on a desktop
    // than on a phone, and today has to land in the middle of what is left.
    const stickyWidth =
      container.querySelector<HTMLElement>('[data-sticky]')?.getBoundingClientRect().width ?? 0
    const cellWidth = todayCell.getBoundingClientRect().width
    const x = todayCell.getBoundingClientRect().left - container.getBoundingClientRect().left
    const free = container.clientWidth - stickyWidth
    const wanted = stickyWidth + (free - cellWidth) / 2

    container.scrollLeft = Math.max(0, container.scrollLeft + (x - wanted))
  }, [])

  const canFocus = (cell: Cell) => {
    const day = days[cell.col]

    return day !== undefined && cell.row >= 0 && cell.row < habits.length && day.date <= today
  }

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const cell = cellFrom(event.target)

    if (cell === null || (cell.row === anchor.row && cell.col === anchor.col)) {
      return
    }

    setAnchor({ row: cell.row, col: cell.col })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = ARROW_TO_DIRECTION[event.key]

    if (direction === undefined) {
      return
    }

    const from = cellFrom(event.target)

    if (from === null) {
      return
    }

    // Focus is moved by hand rather than left to the browser: the grid steps
    // over disabled days, which is not something tab order will do.
    event.preventDefault()

    const next = findFocusableCell(from, direction, habits.length, days.length, canFocus)

    if (next === null) {
      return
    }

    scrollRef.current
      ?.querySelector<HTMLElement>(
        `[data-cell][data-row="${next.row}"][data-col="${next.col}"] button`,
      )
      ?.focus()
  }

  if (habits.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
        <p className="text-sm font-medium">Add your first habit</p>
        <p className="text-xs text-text-on-light/60">
          One small thing you want to do on most days.
        </p>
        <Button variant="primary" className="mt-1" onClick={onAddHabit}>
          Add habit
        </Button>
      </div>
    )
  }

  // An anchor on a row that has since been archived would leave the grid with
  // no tab stop at all, so it falls back to the first row.
  const anchorRow = anchor.row < habits.length ? anchor.row : 0

  return (
    <>
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-t-card"
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      >
        <div className="w-max min-w-full">
          <div className="flex h-12 items-stretch border-b border-border-light">
            <div
              data-sticky
              className={`sticky left-0 z-10 flex items-center justify-between gap-2 border-r border-border-light bg-card-light px-3 md:px-4 ${LEFT_CELL}`}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-text-on-light/55">
                Habit
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-text-on-light/55">
                Goal
              </span>
            </div>

            {days.map((day) => (
              <div
                key={day.date}
                data-today={day.date === today ? '' : undefined}
                className={`${DAY_COLUMN} flex flex-col items-center justify-center gap-1 ${columnWash(day, today)}`}
              >
                <span className="text-xs font-semibold leading-none text-text-on-light">
                  {day.day}
                </span>
                <span className="text-xs leading-none text-text-on-light/45">{day.weekday}</span>
              </div>
            ))}

            <div className={RIGHT_CELL} />
          </div>

          {habits.map((habit, row) => {
            const completed = habitCompleted(habit.id, checkins, monthKey)
            const pct = habitProgressPct(habit, completed)

            return (
              <div
                key={habit.id}
                className="flex h-12 items-stretch border-b border-border-light/60"
              >
                <div
                  data-sticky
                  className={`sticky left-0 z-10 flex flex-col justify-center gap-1 border-r border-border-light bg-card-light px-3 md:px-4 ${LEFT_CELL}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{habit.name}</span>
                    <span className="tabular shrink-0 text-xs text-text-on-light/55 md:hidden">
                      {pct}%
                    </span>
                  </span>
                  <span className="text-xs text-text-on-light/55">Goal {habit.monthlyGoal}</span>
                </div>

                {days.map((day, col) => {
                  const isChecked = checked.has(`${habit.id}|${day.date}`)

                  return (
                    <div
                      key={day.date}
                      data-cell
                      data-row={row}
                      data-col={col}
                      data-today={day.date === today ? '' : undefined}
                      className={`${DAY_COLUMN} flex items-center justify-center ${columnWash(day, today)}`}
                    >
                      <CheckCell
                        checked={isChecked}
                        color={habit.color}
                        size={36}
                        tone="light"
                        today={day.date === today}
                        disabled={day.date > today}
                        tabIndex={row === anchorRow && col === anchor.col ? 0 : -1}
                        label={`${habit.name}, ${day.label}, ${isChecked ? 'done' : 'not done'}`}
                        onClick={() => {
                          onToggle(habit.id, day.date, !isChecked)
                        }}
                      />
                    </div>
                  )
                })}

                <div role="group" aria-label={`${habit.name} progress`} className={RIGHT_CELL}>
                  <ProgressBar value={pct} color={habit.color} showValue tone="light" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border-light">
        <button
          type="button"
          onClick={onAddHabit}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-text-on-light/70 transition-colors duration-150 ease-out hover:text-text-on-light"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          Add habit
        </button>
      </div>

      <div className="border-t border-border-light px-4 py-4 sm:px-6">
        <p className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-semibold sm:text-3xl">
            {monthTotals.completed}/{monthTotals.goal}
          </span>
          <span className="text-sm font-medium text-text-on-light/60">Completed</span>
        </p>
      </div>
    </>
  )
}
