import type { ButtonHTMLAttributes } from 'react'

import { ACCENT_BG_CLASS, ACCENT_ON_CLASS, type AccentName } from '@/lib/accents'

export interface CheckCellProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'color'> {
  /** Whether the day is done. Toggles. */
  checked: boolean
  /** Accent used for the checked fill. */
  color?: AccentName
  /** Draws the subtle ring marking today. */
  today?: boolean
  /** Side length in px. */
  size?: number
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
      : 'bg-transparent border-2 border-dotted border-text-muted-on-dark/45 hover:border-text-muted-on-dark/75'

  const todayRing = today && !disabled ? 'ring-2 ring-text-on-dark/25 ring-offset-2 ring-offset-bg-surface' : ''

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