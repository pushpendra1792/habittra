import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

/** First-load count-up length. Matches the ring fill animation. */
export const COUNT_UP_MS = 700

/**
 * Counts from zero to `target` once, then follows later values immediately.
 *
 * A later check-in changes the number, but it should not replay the flourish
 * from zero. Once the first run finishes, the new value is returned directly.
 * Reduced motion skips the count entirely.
 */
export function useCountUp(target: number, durationMs = COUNT_UP_MS): number {
  const reduceMotion = useReducedMotion() === true
  const [display, setDisplay] = useState(0)
  const [finished, setFinished] = useState(false)
  const shown = useRef(0)

  useEffect(() => {
    if (reduceMotion) {
      shown.current = target
      return
    }

    if (finished) {
      shown.current = target
      return
    }

    const from = shown.current
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - progress) ** 3
      const next = from + (target - from) * eased

      shown.current = next

      if (progress < 1) {
        setDisplay(next)
        frame = requestAnimationFrame(tick)
        return
      }

      shown.current = target
      setDisplay(target)
      setFinished(true)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [durationMs, finished, reduceMotion, target])

  if (reduceMotion || finished) {
    return target
  }

  return display
}
