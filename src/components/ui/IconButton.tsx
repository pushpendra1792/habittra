import type { ButtonHTMLAttributes, ReactNode } from 'react'

import type { ButtonSize, ButtonVariant } from './Button'

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  /**
   * Required. An icon-only control has no visible text, so the accessible name
   * must be supplied by the caller. The type system enforces it: this prop has
   * no `?`, so the component cannot be rendered without one.
   */
  'aria-label': string
  /** The icon. Must be decorative; the label above carries the meaning. */
  icon: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders a circle instead of a rounded square. */
  round?: boolean
}

const sizes: Record<ButtonSize, string> = {
  sm: 'size-8',
  md: 'size-10',
  lg: 'size-12',
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-teal text-on-accent-teal hover:bg-accent-teal/85',
  secondary:
    'bg-transparent border border-border-dark hover:bg-text-on-dark/8 hover:border-text-muted-on-dark/40',
  ghost: 'bg-transparent hover:bg-text-on-dark/8',
  danger: 'bg-accent-coral text-on-accent-coral hover:bg-accent-coral/85',
}

/**
 * Icon-only button. Always square, always labelled.
 */
export function IconButton({
  'aria-label': ariaLabel,
  icon,
  variant = 'ghost',
  size = 'md',
  round = false,
  type = 'button',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center shrink-0',
        'transition-colors duration-150 ease-out select-none',
        'disabled:opacity-45 disabled:cursor-not-allowed',
        round ? 'rounded-pill' : 'rounded-sm',
        sizes[size],
        variants[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
    </button>
  )
}