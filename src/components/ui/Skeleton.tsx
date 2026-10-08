import type { HTMLAttributes } from 'react'

export type SkeletonRadius = 'sm' | 'card' | 'pill' | 'full'
export type SkeletonTone = 'dark' | 'light'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Fixed width. Defaults to 100% of the container. */
  width?: number | string
  /** Fixed height. Defaults to 1em so it tracks the surrounding text size. */
  height?: number | string
  radius?: SkeletonRadius
  /**
   * Surface being held. On the light panel a dark card's shimmer is invisible,
   * so the tracker's loading state asks for the light one.
   */
  tone?: SkeletonTone
}

const radii: Record<SkeletonRadius, string> = {
  sm: 'rounded-sm',
  card: 'rounded-card',
  pill: 'rounded-pill',
  full: 'rounded-full',
}

const tones: Record<SkeletonTone, string> = {
  dark: 'bg-text-on-dark/12',
  light: 'bg-text-on-light/10',
}

/**
 * Placeholder block shown while content loads.
 *
 * Purely decorative, so it is hidden from assistive tech: the loading state
 * belongs to whatever is replacing it. The shimmer is a CSS animation, which the
 * global reduced-motion rule stops.
 */
export function Skeleton({
  width,
  height,
  radius = 'sm',
  tone = 'dark',
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse ${tones[tone]} ${radii[radius]} ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? '1em',
        ...style,
      }}
      {...rest}
    />
  )
}
