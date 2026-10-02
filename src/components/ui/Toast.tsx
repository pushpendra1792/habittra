import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  nextToastId,
  TOAST_DURATION_MS,
  ToastContext,
  type Toast,
  type ToastOptions,
} from '@/lib/toast'

export interface ToastProviderProps {
  children?: ReactNode
}

/**
 * Holds the toast queue. Mount once, near the root.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<readonly Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((options: ToastOptions) => {
    const id = nextToastId()

    setToasts((current) => [
      ...current,
      {
        id,
        message: options.message,
        durationMs: options.durationMs ?? TOAST_DURATION_MS,
        ...(options.actionLabel !== undefined ? { actionLabel: options.actionLabel } : {}),
        ...(options.onAction !== undefined ? { onAction: options.onAction } : {}),
      },
    ])

    return id
  }, [])

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

interface ToastItemProps {
  toast: Toast
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const reduceMotion = useReducedMotion()
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    clear()

    if (toast.durationMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(toast.id)
      }, toast.durationMs)
    }
  }, [clear, onDismiss, toast.durationMs, toast.id])

  useEffect(() => {
    start()

    return clear
  }, [start, clear])

  // Hovering or focusing pauses the countdown, so the action stays reachable.
  const pause = () => {
    setPaused(true)
    clear()
  }

  const resume = () => {
    setPaused(false)
    start()
  }

  const duration = reduceMotion === true ? 0 : 0.2

  return (
    <motion.li
      layout={reduceMotion !== true}
      initial={{
        opacity: 0,
        y: reduceMotion === true ? 0 : 12,
        scale: reduceMotion === true ? 1 : 0.98,
      }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: reduceMotion === true ? 0 : 8, scale: 1 }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-sm border
        border-border-dark bg-bg-surface px-3 py-2.5 shadow-lg sm:w-80"
    >
      <p className="min-w-0 flex-1 text-sm text-text-on-dark">{toast.message}</p>

      {toast.actionLabel !== undefined ? (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.()
            onDismiss(toast.id)
          }}
          className="shrink-0 rounded-sm px-2 py-1 text-xs font-semibold text-accent-teal
            transition-colors duration-150 ease-out hover:bg-accent-teal/12"
        >
          {toast.actionLabel}
        </button>
      ) : null}

      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => {
          onDismiss(toast.id)
        }}
        className="grid size-6 shrink-0 place-items-center rounded-sm text-text-muted-on-dark
          transition-colors duration-150 ease-out hover:bg-text-on-dark/8 hover:text-text-on-dark"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>

      {paused ? <span className="sr-only">Timer paused</span> : null}
    </motion.li>
  )
}

/**
 * Fixed-position toast stack. Mount once, outside the page content.
 *
 * Reads the queue from ToastProvider, so it must be a descendant of it.
 */
export function ToastViewport() {
  const context = useContext(ToastContext)

  if (context === null) {
    return null
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-stretch
        gap-2 px-3 pb-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:items-end sm:px-0"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {context.toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={context.dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}
