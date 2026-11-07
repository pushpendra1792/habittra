import { useEffect, useState } from 'react'

import { ACCENT_STROKE_CLASS, type AccentName } from '@/lib/accents'
import { clampPercent } from '@/lib/numbers'

export type RingTone = 'dark' | 'light'

export interface DonutRingProps {
  /** Completion from 0 to 100. Values outside the range are clamped. */
  value: number
  /** Accent for the filled arc. Defaults to teal. */
  color?: AccentName
  /** Diameter in px. Stroke width scales with it. */
  size?: number
  /** Surface the ring sits on. Picks a track colour that reads on it. */
  tone?: RingTone
  /** Replaces the default percentage in the middle. */
  label?: string
  /** Small caption under the label, e.g. "of 30 days". */
  caption?: string
  /** Accessible name for the ring. */
  ariaLabel?: string
  /**
   * How long the first fill takes, in milliseconds. Later value changes keep
   * the default 200ms so a check-in is a smooth update, not a second entrance.
   */
  enterDurationMs?: number
}

const trackColors: Record<RingTone, string> = {
  dark: 'stroke-text-on-dark/15',
  light: 'stroke-text-on-light/15',
}

const labelColors: Record<RingTone, string> = {
  dark: 'text-text-on-dark',
  light: 'text-text-on-light',
}

/**
 * Circular progress ring. The arc animates from empty on mount using a CSS
 * transition, so the global prefers-reduced-motion rule neutralises it without
 * any JS branching.
 */
export function DonutRing({
  value,
  color = 'teal',
  size = 120,
  tone = 'dark',
  label,
  caption,
  ariaLabel,
  enterDurationMs,
}: DonutRingProps) {
  const target = clampPercent(value)
  const [drawn, setDrawn] = useState(0)
  const [entered, setEntered] = useState(enterDurationMs === undefined)

  useEffect(() => {
    // Next frame, so the browser has already painted the empty ring and the
    // transition has something to animate from.
    const frame = requestAnimationFrame(() => {
      setDrawn(target)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [target])

  useEffect(() => {
    if (enterDurationMs === undefined) {
      return
    }

    const timer = setTimeout(() => {
      setEntered(true)
    }, enterDurationMs)

    return () => {
      clearTimeout(timer)
    }
  }, [enterDurationMs])

  const stroke = Math.max(6, Math.round(size * 0.09))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - drawn / 100)

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={ariaLabel ?? `${Math.round(target)} percent complete`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackColors[tone]}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${ACCENT_STROKE_CLASS[color]} transition-[stroke-dashoffset] duration-200 ease-out`}
          style={
            entered || enterDurationMs === undefined
              ? undefined
              : { transitionDuration: `${enterDurationMs}ms` }
          }
        />
      </svg>

      <div
        className={`absolute inset-0 grid place-content-center text-center ${labelColors[tone]}`}
      >
        <span className="tabular block text-xl font-semibold leading-none">
          {label ?? `${Math.round(target)}%`}
        </span>
        {caption !== undefined ? (
          <span className="mt-0.5 block text-[0.625rem] text-current opacity-70">{caption}</span>
        ) : null}
      </div>
    </div>
  )
}
