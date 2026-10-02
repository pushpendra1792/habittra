import { useId, useState, type InputHTMLAttributes } from 'react'

import { isAtBound, stepValue } from '@/lib/numbers'

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'step' | 'min' | 'max' | 'size'
> {
  /** Current value. Controlled. */
  value: number
  /** Fired with the next value whenever a stepper is pressed or text is typed. */
  onValueChange: (value: number) => void
  /** Lower bound. Also the value the decrement stepper stops at. */
  min?: number
  /** Upper bound. Also the value the increment stepper stops at. */
  max?: number
  /** Amount each stepper press moves the value. */
  step?: number
  /** Visible label. */
  label?: string
  /** Helper text shown when there is no error. */
  hint?: string
  /** Error text. */
  error?: string
}

function StepperGlyph({ direction }: { direction: 'up' | 'down' }) {
  return (
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
      {direction === 'up' ? (
        <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
      ) : (
        <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
      )}
    </svg>
  )
}

/**
 * Numeric field with decrement and increment steppers, used for goals.
 *
 * Both steppers disable themselves at their bound, so the field never offers a
 * step that would do nothing.
 */
export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  hint,
  error,
  className = '',
  id,
  disabled = false,
  ...rest
}: NumberInputProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const describedBy = error !== undefined ? errorId : hint !== undefined ? hintId : undefined

  // Raw text while the field has focus. Clamping on every keystroke would fight
  // the user: typing "-40" would snap to the minimum after the "-" and the rest
  // would land in the wrong place. The draft is what is displayed; the clamped
  // value is what is emitted. The draft clears on blur and on a stepper press.
  const [draft, setDraft] = useState<string | null>(null)

  const canDecrement = !disabled && !isAtBound(value, -step, min, max)
  const canIncrement = !disabled && !isAtBound(value, step, min, max)

  const applyStep = (direction: 1 | -1) => {
    setDraft(null)
    onValueChange(stepValue(value, step * direction, min, max))
  }

  const handleChange = (next: string) => {
    setDraft(next)

    if (next.trim() === '') {
      return
    }

    const parsed = Number(next)

    if (Number.isNaN(parsed)) {
      return
    }

    onValueChange(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label !== undefined ? (
        <label htmlFor={fieldId} className="text-xs font-medium text-text-muted-on-dark">
          {label}
        </label>
      ) : null}

      <div
        className={`flex items-stretch overflow-hidden rounded-sm border border-border-dark
          bg-bg-base transition-colors duration-150 ease-out
          hover:border-text-muted-on-dark/40
          focus-within:border-accent-teal
          ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
      >
        <button
          type="button"
          aria-label={`Decrease${label !== undefined ? ` ${label}` : ''}`}
          disabled={!canDecrement}
          onClick={() => {
            applyStep(-1)
          }}
          className="grid w-10 shrink-0 place-items-center text-text-muted-on-dark transition-colors
            duration-150 ease-out hover:bg-text-on-dark/8 hover:text-text-on-dark
            disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <StepperGlyph direction="down" />
        </button>

        <input
          id={fieldId}
          type="number"
          inputMode="numeric"
          value={draft ?? value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy}
          onChange={(event) => {
            handleChange(event.target.value)
          }}
          onBlur={() => {
            setDraft(null)
          }}
          className="tabular h-10 w-full min-w-0 border-x border-border-dark bg-transparent px-3 text-center
            text-sm text-text-on-dark [appearance:textfield] disabled:cursor-not-allowed
            [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          {...rest}
        />

        <button
          type="button"
          aria-label={`Increase${label !== undefined ? ` ${label}` : ''}`}
          disabled={!canIncrement}
          onClick={() => {
            applyStep(1)
          }}
          className="grid w-10 shrink-0 place-items-center text-text-muted-on-dark transition-colors
            duration-150 ease-out hover:bg-text-on-dark/8 hover:text-text-on-dark
            disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <StepperGlyph direction="up" />
        </button>
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
