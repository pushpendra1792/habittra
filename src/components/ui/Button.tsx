import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight. Primary is the single call to action on a screen. */
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner, sets aria-busy and blocks clicks. The label stays visible. */
  loading?: boolean
  /** Content rendered before the label. Decorative only, hidden from assistive tech. */
  iconStart?: ReactNode
  children?: ReactNode
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap ' +
  'transition-colors duration-150 ease-out select-none ' +
  'disabled:opacity-45 disabled:cursor-not-allowed'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-teal text-on-accent-teal hover:bg-accent-teal/85',
  secondary:
    'bg-transparent text-text-on-dark border border-border-dark hover:bg-text-on-dark/8 hover:border-text-muted-on-dark/40',
  ghost: 'bg-transparent text-text-muted-on-dark hover:bg-text-on-dark/8 hover:text-text-on-dark',
  danger: 'bg-accent-coral text-on-accent-coral hover:bg-accent-coral/85',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

function Spinner() {
  return (
    <svg
      className="size-3.5 animate-spin shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Primary action control. Variants differ in fill and border, not colour alone. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  iconStart,
  className = '',
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {loading ? null : iconStart}
      {children}
    </button>
  )
}