import { useContext } from 'react'

import { ToastContext, type ToastContextValue } from '@/lib/toast'

/**
 * Queues toasts. Requires a ToastProvider above the caller.
 *
 * Returns the queue, a `toast()` function that pushes a notification and returns
 * its id, and `dismiss()` to remove one early.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)

  if (context === null) {
    throw new Error('useToast must be used inside a ToastProvider')
  }

  return context
}
