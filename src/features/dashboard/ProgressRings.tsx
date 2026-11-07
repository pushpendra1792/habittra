import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useReducedMotion } from 'framer-motion'

import { Card } from '@/components/ui/Card'
import { DonutRing } from '@/components/ui/DonutRing'
import { IconButton } from '@/components/ui/IconButton'
import type { AccentName } from '@/lib/accents'
import { formatOneDecimal } from './chartModel'
import { useCountUp } from './useCountUp'

export interface ProgressRingsProps {
  monthlyProgressPct: number
  normalizedProgressPct: number
  momentumPct: number
  isFuture?: boolean
  className?: string
}

interface RingSpec {
  id: string
  title: string
  value: number
  color: AccentName
  note?: string
}

const PACE_NOTE =
  'Pace-adjusted compares what you have done with the part of the month that has passed.'

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5" strokeLinecap="round" />
      <circle cx="10" cy="6.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface RingCardProps extends RingSpec {
  isFuture: boolean
}

function RingCard({ title, value, color, note, isFuture }: RingCardProps) {
  const animated = useCountUp(value)
  const [noteOpen, setNoteOpen] = useState(false)
  const noteId = useId()
  const shown = isFuture ? '—' : `${formatOneDecimal(animated)}%`
  const accessibleValue = isFuture
    ? `${title}, not available for a future month`
    : `${title}, ${formatOneDecimal(value)} percent`

  return (
    <Card className="flex min-w-full snap-center flex-col gap-3 md:min-w-0">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-on-dark">{title}</h3>

        {note !== undefined ? (
          <IconButton
            aria-label="What does pace-adjusted mean?"
            aria-expanded={noteOpen}
            aria-controls={noteId}
            icon={<InfoIcon />}
            variant="ghost"
            size="sm"
            round
            onClick={() => {
              setNoteOpen((open) => !open)
            }}
          />
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center py-1">
        <DonutRing
          value={value}
          color={color}
          size={132}
          label={shown}
          ariaLabel={accessibleValue}
          enterDurationMs={700}
        />
      </div>

      {note !== undefined ? (
        <p
          id={noteId}
          hidden={!noteOpen}
          className="text-xs leading-relaxed text-text-muted-on-dark"
        >
          {note}
        </p>
      ) : null}
    </Card>
  )
}

/**
 * The three progress rings.
 *
 * Desktop is a quiet three-column row. Under 768px the same cards become a
 * scroll-snap carousel with dot buttons, so they stay one-handed rather than
 * shrinking to three unreadable slivers. The ring values are Phase 2 results;
 * this component only formats them.
 */
export function ProgressRings({
  monthlyProgressPct,
  normalizedProgressPct,
  momentumPct,
  isFuture = false,
  className = '',
}: ProgressRingsProps) {
  const reduceMotion = useReducedMotion() === true
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const rings: RingSpec[] = [
    {
      id: 'monthly',
      title: 'Monthly progress',
      value: monthlyProgressPct,
      color: 'coral',
    },
    {
      id: 'pace',
      title: 'Pace-adjusted',
      value: normalizedProgressPct,
      color: 'blue',
      note: PACE_NOTE,
    },
    {
      id: 'momentum',
      title: 'Last 3 days momentum',
      value: momentumPct,
      color: 'yellow',
    },
  ]

  const summary = isFuture
    ? 'Progress rings are not available for a future month.'
    : `Monthly progress ${formatOneDecimal(monthlyProgressPct)} percent. Pace-adjusted ${formatOneDecimal(normalizedProgressPct)} percent. Last three days momentum ${formatOneDecimal(momentumPct)} percent.`

  const goTo = (index: number) => {
    const container = scrollRef.current

    if (container === null) {
      return
    }

    const card = container.children.item(index) as HTMLElement | null

    if (card === null) {
      return
    }

    container.scrollTo({
      left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
    setActive(index)
  }

  const handleScroll = () => {
    const container = scrollRef.current

    if (container === null) {
      return
    }

    const centre = container.scrollLeft + container.clientWidth / 2
    let nearest = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    for (let index = 0; index < container.children.length; index += 1) {
      const card = container.children.item(index) as HTMLElement | null

      if (card === null) {
        continue
      }

      const cardCentre = card.offsetLeft + card.clientWidth / 2
      const distance = Math.abs(cardCentre - centre)

      if (distance < nearestDistance) {
        nearest = index
        nearestDistance = distance
      }
    }

    setActive((current) => (current === nearest ? current : nearest))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    const container = scrollRef.current

    // On desktop there is nothing to scroll, so leave the arrow keys alone.
    if (container === null || container.scrollWidth <= container.clientWidth) {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = Math.min(rings.length - 1, Math.max(0, active + direction))

    goTo(next)
  }

  return (
    <section className={className} aria-label="Progress rings" aria-roledescription="carousel">
      <div
        ref={scrollRef}
        role="group"
        aria-label="Progress rings carousel"
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0"
      >
        {rings.map((ring) => (
          <RingCard key={ring.id} {...ring} isFuture={isFuture} />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1 md:hidden">
        {rings.map((ring, index) => (
          <button
            key={ring.id}
            type="button"
            aria-label={`Show ${ring.title}`}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => {
              goTo(index)
            }}
            className="grid size-11 place-items-center rounded-full text-text-on-dark"
          >
            <span
              aria-hidden="true"
              className={`block size-2 rounded-full transition-colors ${
                index === active ? 'bg-accent-teal' : 'bg-text-on-dark/30'
              }`}
            />
          </button>
        ))}
      </div>

      <p className="sr-only">{summary}</p>
    </section>
  )
}
