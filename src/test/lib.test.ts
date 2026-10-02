import { describe, expect, it } from 'vitest'

import { ACCENT_NAMES, accentAt } from '@/lib/accents'
import { clamp, clampPercent, isAtBound, stepValue } from '@/lib/numbers'

describe('clamp', () => {
  it('leaves a value inside the range alone', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('pulls a value below the range up to the minimum', () => {
    expect(clamp(-4, 0, 10)).toBe(0)
  })

  it('pulls a value above the range down to the maximum', () => {
    expect(clamp(99, 0, 10)).toBe(10)
  })

  it('keeps values exactly on the bounds', () => {
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('collapses NaN to the minimum rather than propagating it', () => {
    expect(clamp(Number.NaN, 2, 8)).toBe(2)
  })
})

describe('clampPercent', () => {
  it('keeps percentages in 0-100', () => {
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(50)).toBe(50)
    expect(clampPercent(100)).toBe(100)
  })

  it('clamps values outside 0-100', () => {
    expect(clampPercent(-1)).toBe(0)
    expect(clampPercent(101)).toBe(100)
    expect(clampPercent(1e6)).toBe(100)
  })

  it('treats NaN as empty rather than letting it reach the DOM', () => {
    expect(clampPercent(Number.NaN)).toBe(0)
  })
})

describe('stepValue', () => {
  it('steps up and down by the given amount', () => {
    expect(stepValue(5, 1, 0, 10)).toBe(6)
    expect(stepValue(5, -1, 0, 10)).toBe(4)
  })

  it('honours a step larger than one', () => {
    expect(stepValue(10, 5, 0, 100)).toBe(15)
  })

  it('pins to the bound instead of running past it', () => {
    expect(stepValue(10, 1, 0, 10)).toBe(10)
    expect(stepValue(0, -1, 0, 10)).toBe(0)
  })

  it('stays at the bound when asked to step further than there is room', () => {
    expect(stepValue(9, 5, 0, 10)).toBe(10)
    expect(stepValue(1, -5, 0, 10)).toBe(0)
  })

  it('returns the same value when step is zero', () => {
    expect(stepValue(4, 0, 0, 10)).toBe(4)
  })
})

describe('isAtBound', () => {
  it('reports true at the maximum when stepping up', () => {
    expect(isAtBound(10, 1, 0, 10)).toBe(true)
  })

  it('reports true at the minimum when stepping down', () => {
    expect(isAtBound(0, -1, 0, 10)).toBe(true)
  })

  it('reports false when a step would still change the value', () => {
    expect(isAtBound(9, 1, 0, 10)).toBe(false)
    expect(isAtBound(1, -1, 0, 10)).toBe(false)
  })

  it('reports false at a bound when stepping away from it', () => {
    expect(isAtBound(10, -1, 0, 10)).toBe(false)
    expect(isAtBound(0, 1, 0, 10)).toBe(false)
  })
})

describe('accentAt', () => {
  it('follows the product order for the first cycle', () => {
    expect(ACCENT_NAMES).toEqual(['teal', 'blue', 'purple', 'yellow', 'coral'])
    expect(accentAt(0)).toBe('teal')
    expect(accentAt(1)).toBe('blue')
    expect(accentAt(2)).toBe('purple')
    expect(accentAt(3)).toBe('yellow')
    expect(accentAt(4)).toBe('coral')
  })

  it('repeats after the fifth habit', () => {
    expect(accentAt(5)).toBe('teal')
    expect(accentAt(6)).toBe('blue')
    expect(accentAt(10)).toBe('teal')
  })

  it('wraps backwards from the start', () => {
    expect(accentAt(-1)).toBe('coral')
    expect(accentAt(-5)).toBe('teal')
    expect(accentAt(-6)).toBe('coral')
  })

  it('handles large indexes without losing the cycle', () => {
    expect(accentAt(1000)).toBe('teal')
    expect(accentAt(1001)).toBe('blue')
  })

  it('truncates fractional indexes to a real colour', () => {
    expect(accentAt(1.9)).toBe('blue')
  })

  it('falls back to the first colour for non-finite input', () => {
    expect(accentAt(Number.NaN)).toBe('teal')
    expect(accentAt(Number.POSITIVE_INFINITY)).toBe('teal')
  })

  it('gives every index a colour', () => {
    for (let index = -20; index <= 20; index += 1) {
      expect(ACCENT_NAMES).toContain(accentAt(index))
    }
  })
})
