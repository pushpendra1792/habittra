/**
 * The line under a form that says what went wrong.
 *
 * The space is always reserved, so a message appearing does not push the button
 * and the links below it down the screen. That matters more than it sounds: a
 * submit button that moves the moment you press it is easy to press twice.
 *
 * Polite rather than assertive, because the message is a result of something the
 * person just did and nothing is on fire.
 */
export interface FormMessageProps {
  /** The sentence to show, or null when there is nothing wrong. */
  message: string | null
  /** Kept tall for the longest copy any auth screen produces, which is two lines at 360px. */
  className?: string
}

export function FormMessage({ message, className = '' }: FormMessageProps) {
  return (
    <div className={`min-h-8 ${className}`} aria-live="polite">
      {message !== null ? <p className="text-xs leading-4 text-accent-coral">{message}</p> : null}
    </div>
  )
}
