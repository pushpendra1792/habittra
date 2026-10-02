import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label. Also becomes the accessible name. */
  label?: string
  /** Helper text shown when there is no error. */
  hint?: string
  /** Error text. When present the field is marked invalid and described by it. */
  error?: string
  /** Rendered inside the field on the trailing edge, e.g. a unit suffix. */
  trailing?: ReactNode
}

/**
 * Single-line text field with label, hint and error wiring.
 */
export function Input({ label, hint, error, trailing, className = '', id, ...rest }: InputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const describedBy = error !== undefined ? errorId : hint !== undefined ? hintId : undefined

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label !== undefined ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-text-muted-on-dark">
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          id={fieldId}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy}
          className={`h-10 w-full rounded-sm border border-border-dark bg-bg-base px-3 text-sm
            text-text-on-dark placeholder:text-text-muted-on-dark/70 transition-colors
            duration-150 ease-out hover:border-text-muted-on-dark/40
            disabled:cursor-not-allowed disabled:opacity-45
            ${trailing !== undefined ? 'pr-12' : ''}`}
          {...rest}
        />
        {trailing !== undefined ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs text-text-muted-on-dark">
            {trailing}
          </span>
        ) : null}
      </div>

      {error !== undefined ? (
        <p id={errorId} className="text-xs text-accent-coral">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={hintId} className="text-xs text-text-muted-on-dark">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
