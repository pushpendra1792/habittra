import type { HTMLAttributes } from 'react'

import { ACCENT_BG_CLASS, type AccentName } from '@/lib/accents'
import { clampPercent } from '@/lib/numbers'

export type ProgressBarTone = 'dark' | 'light'

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Completion from 0 to 100. Values outside the range are clamped. */
  value: number
  /** Accent used for the fill. Defaults to teal. */
  color?: AccentName
  /** Label rendered above the track, and used as the accessible name. */
  label?: string
  /** Prints the value as a percentage beside the label. */
  showValue?: boolean
  /**
   * Surface the bar sits on. The tracker's progress column lives on the light
   * panel, where a track and a value drawn for the dark card would be nearly
   * invisible, so the caller has to say which one it is.
   */
  tone?: ProgressBarTone
}

const labelClasses: Record<ProgressBarTone, string> = {
  dark: 'text-text-muted-on-dark',
  light: 'text-text-on-light/60',
}

const trackClasses: Record<ProgressBarTone, string> = {
  dark: 'bg-text-on-dark/12',
  light: 'bg-text-on-light/12',
}

const tickClasses: Record<ProgressBarTone, string> = {
  dark: 'bg-text-muted-on-dark/70',
  light: 'bg-text-on-light/55',
}

/**
 * Horizontal completion bar. State is carried by the printed value and the
 * zero-state tick, never by colour alone.
 */
export function ProgressBar({
  value,
  color = 'teal',
  label,
  showValue = false,
  tone = 'dark',
  className = '',
  ...rest
}: ProgressBarProps) {
  const clamped = clampPercent(value)
  const isEmpty = clamped === 0

  return (
    <div className={`flex flex-col gap-1.5 ${className}`} {...rest}>
      {label !== undefined || showValue ? (
        <div className="flex items-baseline justify-between gap-2">
          {label !== undefined ? (
            <span className={`text-xs ${labelClasses[tone]}`}>{label}</span>
          ) : (
            <span />
          )}
          {showValue ? (
            <span className={`tabular text-xs ${labelClasses[tone]}`}>{Math.round(clamped)}%</span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className={`relative h-2 w-full overflow-hidden rounded-pill ${trackClasses[tone]}`}
      >
        <div
          className={`h-full rounded-pill transition-[width] duration-200 ease-out ${ACCENT_BG_CLASS[color]}`}
          style={{ width: `${clamped}%` }}
        />

        {/* At zero the fill has no width, so a tick marks the origin of the track. */}
        {isEmpty ? (
          <span
            aria-hidden="true"
            className={`absolute left-0 top-1/2 block h-3 w-0.5 -translate-y-1/2 rounded-pill ${tickClasses[tone]}`}
          />
        ) : null}
      </div>
    </div>
  )
}
