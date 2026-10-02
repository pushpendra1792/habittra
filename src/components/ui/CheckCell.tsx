import type { ButtonHTMLAttributes } from 'react'

import { ACCENT_BG_CLASS, ACCENT_ON_CLASS, type AccentName } from '@/lib/accents'

export type CheckCellTone = 'dark' | 'light'

export interface CheckCellProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'color'
> {
  /** Whether the day is done. Toggles. */
  checked: boolean
  /** Accent used for the checked fill. */
  color?: AccentName
  /** Draws the subtle ring marking today. */
  today?: boolean
  /** Side length in px. */
  size?: number
  /**
   * Surface the grid sits on. The habit grid lives on the light panel, where a
   * pale dotted outline would be invisible, so the empty state has to know.
   */
  tone?: CheckCellTone
  /**
   * Required accessible name. The cell is a bare square, so the day and its
   * state have to come from the caller: "Morning run, Monday, not done".
   */
  label: string
}

function XMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-3/5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

/**
 * Empty state per surface. A pale dotted outline is invisible on the light
 * panel, so the light tone uses a dark one instead.
 */
const emptyState: Record<CheckCellTone, string> = {
  dark: 'bg-transparent border-2 border-dotted border-text-muted-on-dark/45 hover:border-text-muted-on-dark/75',
  light:
    'bg-transparent border-2 border-dotted border-text-on-light/35 hover:border-text-on-light/60',
}

const todayRings: Record<CheckCellTone, string> = {
  dark: 'ring-2 ring-text-on-dark/25 ring-offset-2 ring-offset-bg-surface',
  light: 'ring-2 ring-text-on-light/25 ring-offset-2 ring-offset-card-light',
}

/**
 * One day in the habit grid.
 *
 * State is never carried by colour alone: empty is a dotted outline, checked is
 * a solid fill with an X glyph, today adds a ring, disabled drops opacity. The
 * press animation is a CSS transform, so the global reduced-motion rule handles
 * it.
 */
export function CheckCell({
  checked,
  color = 'teal',
  today = false,
  tone = 'dark',
  size = 40,
  label,
  disabled = false,
  type = 'button',
  className = '',
  ...rest
}: CheckCellProps) {
  const base =
    'relative grid place-items-center rounded-sm transition-[transform,background-color,border-color] ' +
    'duration-150 ease-out active:scale-[0.92] disabled:active:scale-100 disabled:cursor-not-allowed'

  const state = disabled
    ? 'opacity-40'
    : checked
      ? `${ACCENT_BG_CLASS[color]} border border-transparent`
      : emptyState[tone]

  const todayRing = today && !disabled ? todayRings[tone] : ''

  return (
    <button
      type={type}
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      className={`${base} ${state} ${todayRing} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      {checked ? (
        <span className={ACCENT_ON_CLASS[color]}>
          <XMark />
        </span>
      ) : null}
    </button>
  )
}
