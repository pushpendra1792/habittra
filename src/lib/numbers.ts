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
