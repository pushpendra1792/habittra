import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { IconButton } from './IconButton'

export interface ModalProps {
  /** Controls visibility. The dialog unmounts when this is false. */
  open: boolean
  /** Called on Escape, on backdrop click, and by the close button. */
  onClose: () => void
  /** Visible title. Becomes the accessible name of the dialog. */
  title: string
  /** Optional supporting line under the title. */
  description?: string
  /** Footer row, typically the confirm and cancel buttons. */
  footer?: ReactNode
  children?: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function XCloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

/**
 * Centred dialog on tablet and up, bottom sheet on phones.
 *
 * Traps Tab and Shift+Tab inside the dialog, closes on Escape or a backdrop
 * click, restores focus to whatever was focused before it opened, and locks
 * background scroll while open.
 */
export function Modal({ open, onClose, title, description, footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const reduceMotion = useReducedMotion()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const panel = panelRef.current

      if (panel === null) {
        return
      }

      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )

      const first = focusable[0]
      const last = focusable.at(-1)

      if (first === undefined || last === undefined) {
        event.preventDefault()
        return
      }

      const active = document.activeElement

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
        return
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const panel = panelRef.current

    if (panel !== null) {
      const target = panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel
      target.focus()
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
      restoreFocusRef.current?.focus()
    }
  }, [open])

  if (typeof document === 'undefined') {
    return null
  }

  const duration = reduceMotion === true ? 0 : 0.2

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration }}
            onClick={onClose}
            className="absolute inset-0 bg-bg-base/80 backdrop-blur-sm"
          />

          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby={description !== undefined ? 'modal-description' : undefined}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            initial={{ opacity: 0, y: reduceMotion === true ? 0 : 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion === true ? 0 : 24 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-card
              border border-border-dark bg-bg-surface text-text-on-dark
              sm:max-w-lg sm:rounded-card"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-dark p-4 sm:p-5">
              <div className="flex flex-col gap-1">
                <h2 id="modal-title" className="text-base font-semibold">
                  {title}
                </h2>
                {description !== undefined ? (
                  <p id="modal-description" className="text-xs text-text-muted-on-dark">
                    {description}
                  </p>
                ) : null}
              </div>

              <IconButton aria-label="Close dialog" icon={<XCloseIcon />} onClick={onClose} />
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>

            {footer !== undefined ? (
              <footer className="flex justify-end gap-2 border-t border-border-dark p-4 sm:p-5">
                {footer}
              </footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
