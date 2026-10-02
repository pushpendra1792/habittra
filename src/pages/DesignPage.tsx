import { useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CheckCell } from '@/components/ui/CheckCell'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { DonutRing } from '@/components/ui/DonutRing'
import { GlowLine, type GlowLinePoint } from '@/components/ui/GlowLine'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { Modal } from '@/components/ui/Modal'
import { NumberInput } from '@/components/ui/NumberInput'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Skeleton } from '@/components/ui/Skeleton'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/hooks/useToast'
import { ACCENT_HEX, ACCENT_NAMES, ACCENT_ON_HEX, accentAt, type AccentName } from '@/lib/accents'

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/** Sample points for the GlowLine specimen. Not real data. */
const SAMPLE_TREND: readonly GlowLinePoint[] = [
  { label: 'Mon', value: 42 },
  { label: 'Tue', value: 58 },
  { label: 'Wed', value: 51 },
  { label: 'Thu', value: 73 },
  { label: 'Fri', value: 66 },
  { label: 'Sat', value: 88 },
  { label: 'Sun', value: 79 },
]

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text-on-dark">{title}</h2>
        {description !== undefined ? (
          <p className="max-w-prose text-xs text-text-muted-on-dark">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.6875rem] font-medium tracking-wide text-text-muted-on-dark/80 uppercase">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  )
}

function PlusIcon() {
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
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  )
}

function PaletteSection() {
  return (
    <Section
      title="Palette"
      description="Habit colour cycle: teal, blue, purple, yellow, coral, then repeat. Each row shows the colour, the mark colour that sits on it, and the measured contrast against bg-base."
    >
      <Card className="flex flex-col gap-2">
        {ACCENT_NAMES.map((name, index) => (
          <div key={name} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="size-9 shrink-0 rounded-sm"
              style={{ backgroundColor: ACCENT_HEX[name] }}
            />
            <span className="tabular w-16 shrink-0 text-xs font-medium text-text-on-dark">
              {name}
            </span>
            <span className="tabular w-10 shrink-0 text-xs text-text-muted-on-dark">
              #{index + 1} in cycle
            </span>
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-sm"
              style={{
                backgroundColor: ACCENT_HEX[name],
                color: ACCENT_ON_HEX[name],
              }}
            >
              <svg
                viewBox="0 0 16 16"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </span>
            <span className="tabular hidden w-20 shrink-0 text-xs text-text-muted-on-dark sm:block">
              {ACCENT_ON_HEX[name]}
            </span>
            <span className="tabular ml-auto text-xs text-text-muted-on-dark">
              cycle {accentAt(index)} · {accentAt(index + 5)}
            </span>
          </div>
        ))}
      </Card>
    </Section>
  )
}

function ButtonSection() {
  return (
    <Section title="Button" description="Four variants, three sizes, plus loading and disabled.">
      <Card className="flex flex-col gap-5">
        <Specimen label="Variants">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Specimen>

        <Specimen label="Sizes">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Specimen>

        <Specimen label="With icon">
          <Button iconStart={<PlusIcon />}>New habit</Button>
        </Specimen>

        <Specimen label="States">
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="danger" loading>
            Deleting
          </Button>
        </Specimen>
      </Card>
    </Section>
  )
}

function IconButtonSection() {
  return (
    <Section
      title="IconButton"
      description="Square or round. The aria-label prop has no question mark in its type, so the component cannot be rendered without one."
    >
      <Card className="flex flex-col gap-5">
        <Specimen label="Sizes">
          <IconButton aria-label="Small" icon={<TrashIcon />} size="sm" variant="secondary" />
          <IconButton aria-label="Medium" icon={<TrashIcon />} size="md" variant="secondary" />
          <IconButton aria-label="Large" icon={<TrashIcon />} size="lg" variant="secondary" />
        </Specimen>

        <Specimen label="Variants and round">
          <IconButton aria-label="Primary" icon={<TrashIcon />} variant="primary" />
          <IconButton aria-label="Ghost" icon={<TrashIcon />} variant="ghost" />
          <IconButton aria-label="Danger" icon={<TrashIcon />} variant="danger" />
          <IconButton aria-label="Round ghost" icon={<TrashIcon />} round />
          <IconButton aria-label="Disabled" icon={<TrashIcon />} disabled />
        </Specimen>
      </Card>
    </Section>
  )
}

function CardSection() {
  return (
    <Section
      title="Card"
      description="Dark is the default surface. Light is the pale panel the habit grid sits on, which is why the grid needs its own tone."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <span className="text-sm font-medium">Dark card</span>
          <span className="text-xs text-text-muted-on-dark">
            Default surface, 14px radius, 1px border.
          </span>
          <div className="mt-2 flex gap-2">
            <Button size="sm">Action</Button>
            <Button size="sm" variant="ghost">
              Cancel
            </Button>
          </div>
        </Card>

        <Card tone="light" className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-on-light">Light card</span>
          <span className="text-xs text-text-on-light/70">
            Habit grid panel. Text on light is 15.5:1.
          </span>
          <div className="mt-2 flex gap-2">
            <span className="rounded-sm bg-text-on-light/10 px-2 py-1 text-xs text-text-on-light">
              7 day grid
            </span>
          </div>
        </Card>
      </div>
    </Section>
  )
}

function ProgressSection() {
  return (
    <Section
      title="ProgressBar"
      description="At 0% the fill has no width, so a tick marks the origin of the track. The printed value carries the state, not the colour."
    >
      <Card className="flex flex-col gap-5">
        <ProgressBar label="Zero, with tick" value={0} showValue />
        <ProgressBar label="In progress" value={45} showValue />
        <ProgressBar label="Complete" value={100} showValue />
        <ProgressBar label="Out of range, clamped" value={140} showValue />

        <div className="flex flex-col gap-3 border-t border-border-dark pt-5">
          {ACCENT_NAMES.map((name) => (
            <ProgressBar key={name} label={name} value={62} color={name} showValue />
          ))}
        </div>
      </Card>
    </Section>
  )
}

function RingSection() {
  return (
    <Section
      title="DonutRing"
      description="The arc animates from empty on mount with a CSS transition, so prefers-reduced-motion neutralises it without any JS branching."
    >
      <Card className="flex flex-wrap items-center gap-6">
        <DonutRing value={0} caption="nothing yet" />
        <DonutRing value={45} caption="18 of 40 days" />
        <DonutRing value={100} caption="complete" />

        {ACCENT_NAMES.map((name) => (
          <DonutRing key={name} value={72} color={name} size={84} />
        ))}
      </Card>

      <Card tone="light" className="flex flex-wrap items-center gap-6">
        <DonutRing tone="light" value={64} caption="on light" />
        <DonutRing tone="light" value={30} color="coral" size={84} />
      </Card>
    </Section>
  )
}

type GridRowState = Record<AccentName, boolean[]>

function buildInitialRows(): GridRowState {
  const rows = {} as Record<AccentName, boolean[]>

  for (const name of ACCENT_NAMES) {
    rows[name] = [true, true, false, true, true, false, false]
  }

  return rows
}

function CheckCellSection() {
  const [rows, setRows] = useState<GridRowState>(buildInitialRows)

  const toggle = (accent: AccentName, day: number) => {
    setRows((current) => {
      const row = current[accent]
      const next = row.map((done, index) => (index === day ? !done : done))

      return { ...current, [accent]: next }
    })
  }

  return (
    <Section
      title="CheckCell"
      description="Sits on the light panel. Empty is a dotted outline, checked is a solid fill with an X, today adds a ring, disabled drops opacity. Tap a cell to toggle it."
    >
      <Card tone="light" className="flex flex-col gap-5">
        {ACCENT_NAMES.map((accent, index) => {
          const row = rows[accent]

          return (
            <div key={accent} className="flex items-center gap-3">
              <span className="tabular w-12 shrink-0 text-xs font-medium text-text-on-light/70">
                {accent}
              </span>

              <div className="flex flex-wrap gap-1.5">
                {DAY_INITIALS.map((_day, dayIndex) => (
                  <CheckCell
                    key={`${accent}-${String(dayIndex)}`}
                    checked={row[dayIndex] === true}
                    color={accentAt(index)}
                    today={dayIndex === 4}
                    tone="light"
                    size={36}
                    label={`${accent} habit, day ${String(dayIndex + 1)}, ${
                      row[dayIndex] === true ? 'done' : 'not done'
                    }`}
                    onClick={() => {
                      toggle(accent, dayIndex)
                    }}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-3 border-t border-border-light pt-5">
          <span className="text-xs font-medium text-text-on-light/70">States</span>
          <CheckCell checked={false} tone="light" label="Empty" />
          <CheckCell checked tone="light" label="Checked" />
          <CheckCell checked today tone="light" label="Checked today" />
          <CheckCell checked={false} today tone="light" label="Empty today" />
          <CheckCell checked disabled tone="light" label="Checked, disabled" />
          <CheckCell checked={false} disabled tone="light" label="Empty, disabled" />
        </div>
      </Card>
    </Section>
  )
}

function InputSection() {
  const [goal, setGoal] = useState(7)
  const [accent, setAccent] = useState<AccentName>('teal')

  return (
    <Section
      title="Inputs"
      description="Text, bounded number with steppers, and the accent swatches."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <Input label="Habit name" placeholder="Morning run" hint="Shown on the grid." />
          <Input label="With error" defaultValue="Re" error="Give the habit a longer name." />
          <Input label="Disabled" defaultValue="Locked" disabled />
          <Input label="With unit" defaultValue="30" trailing="days" inputMode="numeric" />
        </Card>

        <Card className="flex flex-col gap-4">
          <NumberInput
            label="Weekly goal"
            hint="Steppers disable at 0 and 30."
            value={goal}
            onValueChange={setGoal}
            min={0}
            max={30}
            step={1}
          />
          <NumberInput
            label="At maximum"
            value={30}
            onValueChange={() => undefined}
            min={0}
            max={30}
          />
          <NumberInput label="Disabled" value={4} onValueChange={() => undefined} disabled />
          <NumberInput
            label="With error"
            value={99}
            onValueChange={() => undefined}
            min={0}
            max={100}
            error="Under 100."
          />
        </Card>
      </div>

      <Card className="flex flex-col gap-3">
        <ColorPicker value={accent} onChange={setAccent} />
        <p className="text-xs text-text-muted-on-dark">
          Selected: <span className="font-medium text-text-on-dark">{accent}</span>. Selection shows
          a check glyph and an offset ring as well as fill.
        </p>
      </Card>
    </Section>
  )
}

function OverlaySection() {
  const [open, setOpen] = useState(false)
  const { push } = useToast()

  return (
    <Section
      title="Modal and Toast"
      description="Modal traps focus, closes on Escape and on a backdrop click, and becomes a bottom sheet on phones. Toast auto-dismisses after 5s and pauses while hovered or focused."
    >
      <Card className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setOpen(true)
          }}
        >
          Open modal
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            push({ message: 'Habit archived.' })
          }}
        >
          Plain toast
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            push({
              message: 'Morning run archived.',
              actionLabel: 'Undo',
              onAction: () => {
                push({ message: 'Morning run restored.' })
              },
            })
          }}
        >
          Toast with action
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            push({ message: 'This one stays put.', durationMs: 0 })
          }}
        >
          Sticky toast
        </Button>
      </Card>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
        }}
        title="Archive habit"
        description="The habit stays in your history. You can restore it from the toast."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false)
              }}
            >
              Archive
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted-on-dark">
            Modal content. Tab cycles inside the dialog and focus returns to the trigger when it
            closes.
          </p>
          <Input label="Reason" placeholder="Optional" />
        </div>
      </Modal>
    </Section>
  )
}

function FeedbackSection() {
  const [tab, setTab] = useState('week')

  return (
    <Section title="Skeleton and Tabs" description="Loading placeholder and the segmented control.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <span className="text-xs font-medium text-text-muted-on-dark">Skeleton</span>
          <div className="flex items-center gap-3">
            <Skeleton width={40} height={40} radius="sm" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton height={12} />
              <Skeleton width="60%" height={10} />
            </div>
          </div>
          <Skeleton height={56} radius="card" />
        </Card>

        <Card className="flex flex-col gap-3">
          <span className="text-xs font-medium text-text-muted-on-dark">Tabs</span>
          <Tabs
            ariaLabel="Range"
            value={tab}
            onChange={setTab}
            items={[
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'year', label: 'Year' },
              { id: 'all', label: 'All time', disabled: true },
            ]}
          />
          <p className="text-xs text-text-muted-on-dark">
            Selected <span className="font-medium text-text-on-dark">{tab}</span>. Arrow keys move
            between tabs, Home and End jump to the ends, disabled tabs are skipped.
          </p>
        </Card>
      </div>
    </Section>
  )
}

function TrendSection() {
  return (
    <Section
      title="GlowLine"
      description="Sample points, not real data. Monotone curve so it never overshoots between two values, teal drop shadow at 40% opacity, value above every point."
    >
      <Card className="flex flex-col gap-2">
        <GlowLine data={SAMPLE_TREND} valueSuffix="" ariaLabel="Sample completion trend" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <GlowLine
            data={SAMPLE_TREND}
            color="purple"
            height={180}
            ariaLabel="Sample trend in purple"
          />
        </Card>
        <Card>
          <GlowLine
            data={SAMPLE_TREND}
            color="coral"
            height={180}
            valueSuffix="%"
            ariaLabel="Sample trend in coral"
          />
        </Card>
      </div>
    </Section>
  )
}

/**
 * Review page for the design system. Every component, every state, on the dark
 * background. This page is scaffolding for design review and will not ship.
 */
export function DesignPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-3 border-b border-border-dark pb-6">
        <h1>
          <Logo size="lg" />
        </h1>
        <p className="max-w-prose text-sm text-text-muted-on-dark">
          Design system review. Every component in every state, on the dark background. Checked
          against WCAG AA at 360px, 768px and 1280px.
        </p>
      </header>

      <PaletteSection />
      <ButtonSection />
      <IconButtonSection />
      <CardSection />
      <ProgressSection />
      <RingSection />
      <CheckCellSection />
      <InputSection />
      <OverlaySection />
      <FeedbackSection />
      <TrendSection />
    </main>
  )
}
