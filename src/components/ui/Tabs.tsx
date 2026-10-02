import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem {
  /** Stable identifier, passed back through onChange. */
  id: string
  label: string
  disabled?: boolean
  /** Decorative leading glyph. */
  icon?: ReactNode
}

export interface TabsProps {
  items: readonly TabItem[]
  /** Id of the selected tab. Controlled. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the tab list. */
  ariaLabel: string
  /** Stretches the tabs to fill the row. */
  stretch?: boolean
}

function isSelectable(item: TabItem | undefined): item is TabItem {
  return item !== undefined && item.disabled !== true
}

/**
 * Segmented control following the WAI-ARIA tabs pattern.
 *
 * Selection is shown by fill, weight and an underline bar, so it does not rely
 * on colour. Arrow keys move between tabs, Home and End jump to the ends, and
 * disabled tabs are skipped.
 */
export function Tabs({ items, value, onChange, ariaLabel, stretch = false }: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const selectedIndex = items.findIndex((item) => item.id === value)

  const focusAt = (index: number) => {
    const item = items[((index % items.length) + items.length) % items.length]

    if (!isSelectable(item)) {
      return
    }

    onChange(item.id)

    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    buttons?.[items.indexOf(item)]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault()
        focusAt(selectedIndex + 1)
        break
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault()
        focusAt(selectedIndex - 1)
        break
      }
      case 'Home': {
        event.preventDefault()
        focusAt(0)
        break
      }
      case 'End': {
        event.preventDefault()
        focusAt(items.length - 1)
        break
      }
      default:
        break
    }
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`inline-flex items-center gap-1 rounded-sm border border-border-dark bg-bg-surface p-1 ${
        stretch ? 'w-full' : ''
      }`}
    >
      {items.map((item) => {
        const isSelected = item.id === value

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={isSelected}
            aria-controls={`tabpanel-${item.id}`}
            tabIndex={isSelected ? 0 : -1}
            disabled={item.disabled === true}
            onClick={() => {
              onChange(item.id)
            }}
            className={`relative flex-1 rounded-sm px-3 py-1.5 text-sm transition-colors
              duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40
              ${
                isSelected
                  ? 'bg-text-on-dark/10 font-semibold text-text-on-dark'
                  : 'font-medium text-text-muted-on-dark hover:text-text-on-dark'
              }`}
          >
            {isSelected ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-2 -bottom-1 block h-0.5 rounded-pill bg-accent-teal"
              />
            ) : null}

            <span className="inline-flex items-center gap-1.5">
              {item.icon !== undefined ? (
                <span aria-hidden="true" className="inline-flex">
                  {item.icon}
                </span>
              ) : null}
              {item.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
