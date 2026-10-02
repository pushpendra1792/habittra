/**
 * The accent palette and the habit colour cycle.
 *
 * The order here is the product order: teal, blue, purple, yellow, coral, then
 * repeat. Adding or reordering an entry changes which colour the Nth habit gets,
 * so treat the order as part of the design, not an implementation detail.
 */
export const ACCENT_NAMES = ['teal', 'blue', 'purple', 'yellow', 'coral'] as const

export type AccentName = (typeof ACCENT_NAMES)[number]

/** Mirrors --color-accent-* in src/styles/globals.css. Kept here for canvas/SVG use. */
export const ACCENT_HEX: Record<AccentName, string> = {
  teal: '#3de0b0',
  blue: '#1fb0d0',
  purple: '#6c63d0',
  yellow: '#ffb800',
  coral: '#ff6b6b',
}

/**
 * Colour that sits on top of each accent. White fails on teal (1.7:1), so most
 * accents take the near-black mark instead. Purple is the one that keeps white,
 * at 4.9:1.
 */
export const ACCENT_ON_HEX: Record<AccentName, string> = {
  teal: '#1a1a1a',
  blue: '#1a1a1a',
  purple: '#ffffff',
  yellow: '#1a1a1a',
  coral: '#1a1a1a',
}

export const ACCENT_BG_CLASS: Record<AccentName, string> = {
  teal: 'bg-accent-teal',
  blue: 'bg-accent-blue',
  purple: 'bg-accent-purple',
  yellow: 'bg-accent-yellow',
  coral: 'bg-accent-coral',
}

export const ACCENT_ON_CLASS: Record<AccentName, string> = {
  teal: 'text-on-accent-teal',
  blue: 'text-on-accent-blue',
  purple: 'text-on-accent-purple',
  yellow: 'text-on-accent-yellow',
  coral: 'text-on-accent-coral',
}

export const ACCENT_STROKE_CLASS: Record<AccentName, string> = {
  teal: 'stroke-accent-teal',
  blue: 'stroke-accent-blue',
  purple: 'stroke-accent-purple',
  yellow: 'stroke-accent-yellow',
  coral: 'stroke-accent-coral',
}

/**
 * The accent for a given position in the cycle. Wraps in both directions, so
 * negative indexes count back from the start rather than returning undefined.
 */
export function accentAt(index: number): AccentName {
  if (!Number.isFinite(index)) {
    return ACCENT_NAMES[0]
  }

  const size = ACCENT_NAMES.length
  const wrapped = ((Math.trunc(index) % size) + size) % size
  const name = ACCENT_NAMES[wrapped]

  // Unreachable: wrapped is always in range. Present only to satisfy
  // noUncheckedIndexedAccess.
  return name ?? 'teal'
}
