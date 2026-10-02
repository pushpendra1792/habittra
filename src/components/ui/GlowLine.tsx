import { useId } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  CartesianGrid,
  Line,
  LineChart,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'

import { ACCENT_HEX, type AccentName } from '@/lib/accents'

export interface GlowLinePoint {
  /** Category label under the point, e.g. a weekday initial. */
  label: string
  value: number
}

export interface GlowLineProps {
  data: readonly GlowLinePoint[]
  /** Line and glow colour. Defaults to teal. */
  color?: AccentName
  /** Chart height in px. */
  height?: number
  /** Appended to each value label, e.g. "%". */
  valueSuffix?: string
  /** Accessible name. */
  ariaLabel?: string
}

// Recharts passes these through as `T | undefined`, and exactOptionalPropertyTypes
// rejects an optional prop when undefined is passed explicitly. Declaring them as
// required-but-nullable is the way to accept that.
interface LabelProps {
  x: number | string | undefined
  y: number | string | undefined
  value: number | string | undefined
  index: number | string | undefined
  suffix: string
  color: string
}

function ValueLabel({ x, y, value, suffix, color }: LabelProps) {
  const left = typeof x === 'number' ? x : 0
  const top = typeof y === 'number' ? y : 0

  if (typeof value !== 'number') {
    return null
  }

  return (
    <text
      x={left}
      y={top - 10}
      textAnchor="middle"
      fill={color}
      className="tabular text-[10px] font-medium"
    >
      {`${value}${suffix}`}
    </text>
  )
}

/**
 * Smooth trend line with a soft coloured glow and a value above every point.
 *
 * The curve is monotone so it never overshoots between two real values, which a
 * cubic or catmull spline would. The glow is an SVG drop shadow at 40% opacity.
 */
export function GlowLine({
  data,
  color = 'teal',
  height = 220,
  valueSuffix = '',
  ariaLabel = 'Trend',
}: GlowLineProps) {
  const filterId = `glow-${useId()}`
  const reduceMotion = useReducedMotion()
  const hex = ACCENT_HEX[color]

  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 24, right: 12, bottom: 4, left: -18 }}>
          <defs>
            <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={hex} floodOpacity="0.4" />
            </filter>
          </defs>

          <CartesianGrid stroke="currentColor" className="text-text-on-dark/10" vertical={false} />

          <XAxis
            dataKey="label"
            tick={{ fill: 'currentColor', fontSize: 11 }}
            className="text-text-muted-on-dark"
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          <YAxis
            tick={{ fill: 'currentColor', fontSize: 11 }}
            className="text-text-muted-on-dark"
            axisLine={false}
            tickLine={false}
            width={48}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke={hex}
            strokeWidth={2.5}
            strokeLinecap="round"
            dot={{ r: 3.5, fill: hex, strokeWidth: 0 }}
            activeDot={{ r: 5.5, fill: hex, stroke: 'var(--color-bg-surface)', strokeWidth: 2 }}
            filter={`url(#${filterId})`}
            isAnimationActive={reduceMotion !== true}
            animationDuration={200}
          >
            <LabelList
              content={(props) => (
                <ValueLabel
                  x={props.x}
                  y={props.y}
                  value={props.value as number | undefined}
                  index={props.index}
                  suffix={valueSuffix}
                  color={hex}
                />
              )}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
