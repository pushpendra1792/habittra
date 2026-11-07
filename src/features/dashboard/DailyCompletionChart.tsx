import { useEffect, useId, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { monthName } from '@/features/tracker/monthParam'
import { ACCENT_HEX } from '@/lib/accents'
import type { Totals } from '@/lib/stats'
import type { MonthKey } from '@/types'
import { dailyPoints, recentCountWindow, type DailyPoint } from './chartModel'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export interface DailyCompletionChartProps {
  dailyCounts: readonly (number | null)[]
  maxDailyCount: number
  elapsedDays: number
  daysInMonth: number
  totals: Totals
  monthKey: MonthKey
  className?: string
}

const RANGE_TABS = [
  { id: 'recent', label: 'Last 14 days' },
  { id: 'full', label: 'Full month' },
] as const

interface LabelProps {
  x: number | string | undefined
  y: number | string | undefined
  value: number | string | undefined
  isMax: boolean
  color: string
}

function ValueLabel({ x, y, value, isMax, color }: LabelProps) {
  const left = typeof x === 'number' ? x : 0
  const top = typeof y === 'number' ? y : 0

  if (typeof value !== 'number') {
    return null
  }

  return (
    <text
      x={left}
      y={top - 11}
      textAnchor="middle"
      fill={isMax ? 'var(--color-text-on-dark)' : color}
      className={`tabular text-[9px] ${isMax ? 'font-semibold' : 'font-medium'}`}
    >
      {value}
    </text>
  )
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: DailyPoint
}

function PointDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || payload?.value == null) {
    return null
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={payload.isMax ? 5 : 3.2}
      fill="var(--color-accent-teal)"
      stroke={payload.isMax ? 'var(--color-text-on-dark)' : 'none'}
      strokeWidth={payload.isMax ? 2 : 0}
    />
  )
}

/**
 * The month's daily completions as a teal glow line.
 *
 * It is lazy-loaded by the page so Recharts stays out of the main bundle. The
 * curve is monotone, future days are `null` and therefore break the line, and
 * the busiest elapsed day gets a ringed dot and a brighter value label.
 */
export default function DailyCompletionChart({
  dailyCounts,
  maxDailyCount,
  elapsedDays,
  daysInMonth,
  totals,
  monthKey,
  className = '',
}: DailyCompletionChartProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [range, setRange] = useState<'recent' | 'full'>('recent')
  const [entering, setEntering] = useState(true)
  const reduceMotion = useReducedMotion() === true
  const baseId = useId()
  const filterId = `dashboard-glow-${baseId}`
  const summaryId = `dashboard-chart-summary-${baseId}`

  useEffect(() => {
    const timer = setTimeout(() => {
      setEntering(false)
    }, 760)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  const fullMonth = isDesktop || range === 'full'
  const window = fullMonth
    ? { counts: [...dailyCounts], startDay: 1 }
    : recentCountWindow(dailyCounts, elapsedDays)
  const points = dailyPoints(window.counts, window.startDay)
  const maxIndex = points.findIndex((point) => point.isMax)
  const tickInterval = points.length > 20 ? 3 : 0
  const month = monthName(monthKey)
  const summary = `${month} daily completions. ${totals.completed} check-ins. Busiest day ${maxDailyCount}. ${elapsedDays} of ${daysInMonth} days elapsed.`

  return (
    <Card className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-text-on-dark">Daily completions</h2>
          <p className="mt-0.5 text-xs text-text-muted-on-dark">
            {month} · <span className="tabular">{totals.completed}</span> check-ins
          </p>
        </div>

        <div className="md:hidden">
          <Tabs
            items={RANGE_TABS}
            value={range}
            onChange={(id) => {
              setRange(id === 'full' ? 'full' : 'recent')
            }}
            ariaLabel="Chart range"
          />
        </div>
      </div>

      <p id={summaryId} className="sr-only">
        {summary}
      </p>

      <div
        id={fullMonth ? 'tabpanel-full' : 'tabpanel-recent'}
        role="img"
        aria-label={`${month} daily completions line chart`}
        aria-describedby={summaryId}
        className="text-text-muted-on-dark"
        style={{ height: 220 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 24, right: 10, bottom: 4, left: -12 }}>
            <defs>
              <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow
                  dx="0"
                  dy="0"
                  stdDeviation="5"
                  floodColor={ACCENT_HEX.teal}
                  floodOpacity="0.4"
                />
              </filter>
            </defs>

            <CartesianGrid stroke="currentColor" className="text-text-on-dark/10" vertical={false} />

            <XAxis
              dataKey="day"
              tick={{ fill: 'currentColor', fontSize: 10 }}
              className="text-text-muted-on-dark"
              axisLine={false}
              tickLine={false}
              interval={tickInterval}
              dy={4}
            />
            <YAxis
              tick={{ fill: 'currentColor', fontSize: 10 }}
              className="text-text-muted-on-dark"
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={30}
            />

            <Line
              type="monotone"
              dataKey="value"
              stroke={ACCENT_HEX.teal}
              strokeWidth={2.5}
              strokeLinecap="round"
              dot={<PointDot />}
              activeDot={false}
              filter={`url(#${filterId})`}
              isAnimationActive={!reduceMotion}
              animationDuration={entering ? 700 : 200}
              animationEasing="ease-out"
              connectNulls={false}
            >
              <LabelList
                dataKey="value"
                content={(props) => (
                  <ValueLabel
                    x={props.x}
                    y={props.y}
                    value={props.value as number | undefined}
                    isMax={Number(props.index) === maxIndex}
                    color={ACCENT_HEX.teal}
                  />
                )}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
