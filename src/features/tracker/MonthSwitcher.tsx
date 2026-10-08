import { IconButton } from '@/components/ui/IconButton'
import { Button } from '@/components/ui/Button'
import { addMonths } from '@/lib/dates'
import { monthLabel } from './monthParam'
import type { MonthKey } from '@/types'

export interface MonthSwitcherProps {
  monthKey: MonthKey
  /** Moves to the previous or the next month. */
  onChange: (next: MonthKey) => void
  /** Jumps to the month the device is in. */
  onToday: () => void
  /** True when the month on screen is already the current one. */
  isCurrentMonth: boolean
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {direction === 'left' ? <path d="M10 3L5 8l5 5" /> : <path d="M6 3l5 5-5 5" />}
    </svg>
  )
}

/**
 * Previous, the month and year, next, and a way back to now.
 *
 * The month itself is text, not a control: the two arrows either side of it are
 * how you move, and a label that also opened a picker would be two things
 * pretending to be one.
 */
export function MonthSwitcher({ monthKey, onChange, onToday, isCurrentMonth }: MonthSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <div className="flex items-center gap-1">
        <IconButton
          aria-label={`Previous month, ${monthLabel(addMonths(monthKey, -1))}`}
          icon={<Chevron direction="left" />}
          size="sm"
          onClick={() => {
            onChange(addMonths(monthKey, -1))
          }}
        />

        <h1 className="min-w-36 text-center text-sm font-semibold text-text-on-dark sm:text-base">
          {monthLabel(monthKey)}
        </h1>

        <IconButton
          aria-label={`Next month, ${monthLabel(addMonths(monthKey, 1))}`}
          icon={<Chevron direction="right" />}
          size="sm"
          onClick={() => {
            onChange(addMonths(monthKey, 1))
          }}
        />
      </div>

      <Button variant="ghost" size="sm" disabled={isCurrentMonth} onClick={onToday}>
        Today
      </Button>
    </div>
  )
}
