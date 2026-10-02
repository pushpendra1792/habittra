export type LogoSize = 'sm' | 'md' | 'lg'

export interface LogoProps {
  size?: LogoSize
  className?: string
}

const sizes: Record<LogoSize, string> = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-3xl',
}

/**
 * The wordmark. Text only, no glyph: at small sizes a mark is unreadable and the
 * name carries the brand.
 */
export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <span className={`font-semibold tracking-tight text-text-on-dark ${sizes[size]} ${className}`}>
      Habittra
    </span>
  )
}
