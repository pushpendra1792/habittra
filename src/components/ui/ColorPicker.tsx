import { ACCENT_NAMES, type AccentName } from '@/lib/accents'

export interface ColorPickerProps {
  /** Currently selected accent. */
  value: AccentName
  /** Fired with the newly chosen accent. */
  onChange: (value: AccentName) => void
  /** Field label. Also becomes the group label. */
  label?: string
  /** Blocked when set. */
  disabled?: boolean
  /** Side length of each swatch in px. */
  size?: number
}

function Check({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.5 8.5l3 3 6-6.5" />
    </svg>
  )
}

/**
 * Swatch picker over the five accent colours.
 *
 * Selection is shown by a check glyph and an offset ring as well as by fill, so
 * it never depends on colour alone.
 */
export function ColorPicker({
  value,
  onChange,
  label = 'Colour',
  disabled = false,
  size = 36,
}: ColorPickerProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text-muted-on-dark">{label}</span>

      <div className="flex flex-wrap gap-2">
        {ACCENT_NAMES.map((name) => {
          const isSelected = name === value

          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              aria-label={`${label}: ${name}`}
              aria-pressed={isSelected}
              onClick={() => {
                onChange(name)
              }}
              style={{
                width: size,
                height: size,
                backgroundColor: `var(--color-accent-${name})`,
              }}
              className={`grid place-items-center rounded-sm transition-transform duration-150
                ease-out hover:scale-105 active:scale-[0.92]
                disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100
                ${
                  isSelected
                    ? `ring-2 ring-text-on-dark ring-offset-2 ring-offset-bg-surface`
                    : 'ring-0'
                }
                ${
                  name === 'teal' || name === 'blue' || name === 'yellow' || name === 'coral'
                    ? 'text-on-accent-teal'
                    : 'text-on-accent-purple'
                }`}
            >
              {isSelected ? <Check className="size-4" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
