import { Card } from '@/components/ui/Card'
import { monthName } from '@/features/tracker/monthParam'
import { formatShortDate } from './dateFormat'
import type { MonthStats } from './monthStats'

export interface MonthInfoCardProps {
  stats: Pick<MonthStats, 'year' | 'monthKey' | 'startDate' | 'endDate' | 'daysInMonth'>
  className?: string
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5 xl:flex-row xl:items-baseline xl:justify-between xl:gap-2">
      <dt className="whitespace-nowrap text-[11px] text-text-muted-on-dark">{label}</dt>
      <dd className="tabular whitespace-nowrap text-xs font-medium text-text-on-dark">{value}</dd>
    </div>
  )
}

/**
 * The small month block at the left of the desktop summary.
 *
 * Every value is passed in from `useMonthStats`; this component only decides
 * how to lay the strings out.
 */
export function MonthInfoCard({ stats, className = '' }: MonthInfoCardProps) {
  return (
    <Card className={className}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted-on-dark">
        Month
      </h2>

      <dl className="mt-3 space-y-2">
        <InfoRow label="Year" value={stats.year} />
        <InfoRow label="Month" value={monthName(stats.monthKey)} />
        <InfoRow label="Start date" value={formatShortDate(stats.startDate)} />
        <InfoRow label="End date" value={formatShortDate(stats.endDate)} />
        <InfoRow label="Total days" value={stats.daysInMonth} />
      </dl>
    </Card>
  )
}
