import type { HTMLAttributes, ReactNode } from 'react'

type CardTone = 'dark' | 'light'

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 'dark' sits on the app background. 'light' is the pale panel the habit grid uses. */
  tone?: CardTone
  /** Removes the inner padding, for cards that host their own layout. */
  flush?: boolean
  children?: ReactNode
}

const toneClasses: Record<CardTone, string> = {
  dark: 'bg-bg-surface border-border-dark text-text-on-dark',
  light: 'bg-card-light border-border-light text-text-on-light',
}

/**
 * The one surface primitive. Every panel in the app is a Card.
 */
export function Card({ tone = 'dark', flush = false, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-card border ${toneClasses[tone]} ${flush ? '' : 'p-4 sm:p-5'} ${className}`}
      {...rest}
    />
  )
}