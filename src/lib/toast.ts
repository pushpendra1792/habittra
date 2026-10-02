import { createContext } from 'react'

/** Auto-dismiss delay. Long enough to read and reach the action, short enough not to stack up. */
export const TOAST_DURATION_MS = 5000

export interface Toast {
  id: string
  message: string
  /** Optional trailing action, e.g. "Undo". */
  actionLabel?: string
  onAction?: () => void
  /** Overrides the default auto-dismiss delay. 0 keeps it until dismissed. */
  durationMs: number
}

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
  durationMs?: number
}

export interface ToastContextValue {
  toasts: readonly Toast[]
  /** Queues a toast and returns its id. */
  push: (options: ToastOptions) => string
  /** Removes a toast immediately. */
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

let counter = 0

/** Monotonic id, so two toasts in the same millisecond cannot collide. */
export function nextToastId(): string {
  counter += 1

  return `toast-${counter}`
}
