import { Card } from '@/components/ui/Card'
import { useCountUp } from './useCountUp'

export interface SuccessRateCardProps {
  successRatePct: number
  successMessage: string
  /** A future month has no score, so the card shows a dash. */
  isFuture?: boolean
  className?: string
}

function Heart({ dim = false }: { dim?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 ${dim ? 'opacity-55' : ''}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

/**
 * The coral headline card.
 *
 * The percentage is the rounded Phase 2 success rate. It counts up once on the
 * first load; a later check-in moves it straight to the new value, while the
 * grid and the rings change in the same render.
 */
export function SuccessRateCard({
  successRatePct,
  successMessage,
  isFuture = false,
  className = '',
}: SuccessRateCardProps) {
  const animated = useCountUp(successRatePct)
  const value = isFuture ? '—' : `${Math.round(animated)}%`

  return (
    <Card className={`flex h-full flex-col gap-3 ${className}`}>
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-coral">
          Success rate
        </h2>
        <p className="tabular mt-1 text-4xl font-semibold leading-none tracking-tight text-accent-coral sm:text-5xl">
          {value}
        </p>
      </div>

      <div className="flex items-center gap-1.5 text-accent-coral" aria-hidden="true">
        <Heart />
        <Heart dim />
      </div>

      <p className="text-sm font-medium text-text-on-dark">
        {isFuture ? 'Not started yet' : successMessage}
      </p>
    </Card>
  )
}
