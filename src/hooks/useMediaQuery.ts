import { useCallback, useSyncExternalStore } from 'react'

function hasMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/**
 * Subscribes to a CSS media query.
 *
 * The dashboard uses it only to decide whether the chart should ignore its
 * mobile 14-day toggle and show the whole month. The server snapshot is false,
 * which is also the safe answer when `matchMedia` is unavailable.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!hasMatchMedia()) {
        return () => undefined
      }

      const media = window.matchMedia(query)

      media.addEventListener('change', onChange)

      return () => {
        media.removeEventListener('change', onChange)
      }
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (!hasMatchMedia()) {
      return false
    }

    return window.matchMedia(query).matches
  }, [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
