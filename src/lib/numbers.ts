/** Clamps a number into the inclusive range [min, max]. NaN collapses to min. */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min
  }

  return Math.min(max, Math.max(min, value))
}

/** Clamps any input into the 0-100 percentage range. */
export function clampPercent(value: number): number {
  return clamp(value, 0, 100)
}

/**
 * Moves a numeric field by one step, staying inside [min, max].
 *
 * A step that would leave the range resolves to the bound it crossed, so
 * holding down a stepper pins the value instead of running away.
 */
export function stepValue(current: number, step: number, min: number, max: number): number {
  return clamp(current + step, min, max)
}

/** True when a stepper in this direction would change nothing. */
export function isAtBound(value: number, step: number, min: number, max: number): boolean {
  return stepValue(value, step, min, max) === value
}
