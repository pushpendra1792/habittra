/**
 * Where habits are created, edited, archived and reordered.
 *
 * The modal has two views: the list, which is also where reordering and
 * archiving live, and a single form for one habit. The form state sits in a
 * child that is only mounted while the modal is open, so opening it always
 * starts clean rather than showing whatever was typed last time.
 *
 * Reordering is available two ways on purpose. A drag is the natural gesture on
 * a phone, and the up and down buttons are the same operation for a keyboard,
 * because a sortable list that only responds to a pointer is not usable with a
 * keyboard at all.
 */
import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Button } from '@/components/ui/Button'
import { ColorPicker } from '@/components/ui/ColorPicker'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { NumberInput } from '@/components/ui/NumberInput'
import { ACCENT_BG_CLASS } from '@/lib/accents'
import {
  HABIT_NAME_MAX_LENGTH,
  MONTHLY_GOAL_MAX,
  MONTHLY_GOAL_MIN,
  type Habit,
  type HabitColor,
} from '@/types'

import { canAddHabit, moveHabit, nextHabitColor, activeHabits } from './habitList'
import { useHabitMutations } from './habitMutations'

export interface HabitManagerModalProps {
  open: boolean
  onClose: () => void
  /** Every habit this user has, in list order, archived ones included. */
  habits: readonly Habit[]
  /** Straight into the list, or into a blank form for a new habit. */
  initialView: 'list' | 'add'
}

function GripIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="4" r="1.25" />
      <circle cx="10" cy="4" r="1.25" />
      <circle cx="6" cy="8" r="1.25" />
      <circle cx="10" cy="8" r="1.25" />
      <circle cx="6" cy="12" r="1.25" />
      <circle cx="10" cy="12" r="1.25" />
    </svg>
  )
}

function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
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

function PencilIcon() {
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
      <path d="M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z" />
    </svg>
  )
}

function ArchiveIcon() {
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
      <path d="M2 4.5h12v2.5H2zM3.5 7v6h9V7M6.5 9.5h3" />
    </svg>
  )
}

interface HabitFormProps {
  /** Null for a new habit. */
  habit: Habit | null
  /** The colour a new habit starts on, from the cycle in the list. */
  defaultColor: HabitColor
  onCancel: () => void
  /** Called once the write has landed, to go back to the list. */
  onSaved: () => void
}

function HabitForm({ habit, defaultColor, onCancel, onSaved }: HabitFormProps) {
  const mutations = useHabitMutations()
  const [name, setName] = useState(habit?.name ?? '')
  const [goal, setGoal] = useState(habit?.monthlyGoal ?? 12)
  const [color, setColor] = useState<HabitColor>(habit?.color ?? defaultColor)
  const [error, setError] = useState<string | undefined>(undefined)

  const trimmed = name.trim()

  const save = async () => {
    if (trimmed === '') {
      setError('Give this habit a name.')
      return
    }

    if (trimmed.length > HABIT_NAME_MAX_LENGTH) {
      setError(`Keep the name to ${HABIT_NAME_MAX_LENGTH} characters or fewer.`)
      return
    }

    setError(undefined)

    const ok =
      habit === null
        ? await mutations.add({ name: trimmed, monthlyGoal: goal, color })
        : await mutations.edit(habit.id, { name: trimmed, monthlyGoal: goal, color })

    if (ok) {
      onSaved()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Name"
        value={name}
        autoFocus
        maxLength={HABIT_NAME_MAX_LENGTH}
        placeholder="Morning run"
        // Only passed when there is one: `error` is an optional prop, and this
        // project does not allow handing it an explicit `undefined`.
        {...(error === undefined ? {} : { error })}
        onChange={(event) => {
          setName(event.target.value)
          setError(undefined)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void save()
          }
        }}
      />

      <NumberInput
        label="Days a month"
        hint="How many days count as done. Once a day is the maximum."
        value={goal}
        min={MONTHLY_GOAL_MIN}
        max={MONTHLY_GOAL_MAX}
        onValueChange={setGoal}
      />

      <ColorPicker value={color} onChange={setColor} />

      <div className="flex justify-end gap-2 border-t border-border-dark pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" loading={mutations.isSaving} onClick={() => void save()}>
          {habit === null ? 'Add habit' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

interface SortableRowProps {
  habit: Habit
  isConfirmingArchive: boolean
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onEdit: () => void
  onArchive: () => void
  onCancelArchive: () => void
  onConfirmArchive: () => void
}

function SortableRow({
  habit,
  isConfirmingArchive,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onArchive,
  onCancelArchive,
  onConfirmArchive,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: habit.id,
  })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded-sm border border-border-dark px-2 ${
        isDragging ? 'bg-bg-base opacity-90' : ''
      }`}
    >
      <button
        type="button"
        aria-label={`Reorder ${habit.name}`}
        className="grid size-8 shrink-0 cursor-grab place-items-center rounded-sm text-text-muted-on-dark transition-colors duration-150 ease-out hover:bg-text-on-dark/8 hover:text-text-on-dark active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>

      <span
        aria-hidden="true"
        className={`size-3 shrink-0 rounded-sm ${ACCENT_BG_CLASS[habit.color]}`}
      />

      {isConfirmingArchive ? (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">Archive {habit.name}?</span>
          <Button variant="danger" size="sm" onClick={onConfirmArchive}>
            Archive
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelArchive}>
            Cancel
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-sm">{habit.name}</span>

          <span className="hidden shrink-0 text-xs text-text-muted-on-dark sm:inline">
            Goal {habit.monthlyGoal}
          </span>

          <IconButton
            aria-label={`Move ${habit.name} up`}
            icon={<ArrowIcon direction="up" />}
            size="sm"
            disabled={isFirst}
            onClick={() => {
              onMove(-1)
            }}
          />
          <IconButton
            aria-label={`Move ${habit.name} down`}
            icon={<ArrowIcon direction="down" />}
            size="sm"
            disabled={isLast}
            onClick={() => {
              onMove(1)
            }}
          />
          <IconButton
            aria-label={`Edit ${habit.name}`}
            icon={<PencilIcon />}
            size="sm"
            onClick={onEdit}
          />
          <IconButton
            aria-label={`Archive ${habit.name}`}
            icon={<ArchiveIcon />}
            size="sm"
            onClick={onArchive}
          />
        </>
      )}
    </li>
  )
}

interface ManagerContentProps {
  habits: readonly Habit[]
  initialView: 'list' | 'add'
  onClose: () => void
}

function ManagerContent({ habits, initialView, onClose }: ManagerContentProps) {
  const mutations = useHabitMutations()
  const [view, setView] = useState<'list' | 'form'>(initialView === 'add' ? 'form' : 'list')
  const [editing, setEditing] = useState<Habit | null>(null)
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  // A dialog opened as "Add habit" is that task and nothing else: saving or
  // cancelling closes it. The one opened as "Habits" is the list, and its form
  // comes back to the list, because there is more to do there.
  const isAddSession = initialView === 'add'
  const leaveForm = () => {
    if (isAddSession) {
      onClose()
      return
    }

    setView('list')
    setEditing(null)
  }

  const active = activeHabits(habits)
  const archived = habits.filter((habit) => habit.archived)
  const orderedIds = active.map((habit) => habit.id)
  const atLimit = !canAddHabit(habits)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active: dragged, over } = event

    if (over === null || dragged.id === over.id) {
      return
    }

    const from = orderedIds.indexOf(String(dragged.id))
    const to = orderedIds.indexOf(String(over.id))

    if (from < 0 || to < 0) {
      return
    }

    mutations.reorder(arrayMove(orderedIds, from, to))
  }

  if (view === 'form') {
    return (
      <HabitForm
        habit={editing}
        defaultColor={nextHabitColor(habits)}
        onCancel={leaveForm}
        onSaved={leaveForm}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {active.map((habit, index) => (
              <SortableRow
                key={habit.id}
                habit={habit}
                isConfirmingArchive={confirmArchiveId === habit.id}
                isFirst={index === 0}
                isLast={index === active.length - 1}
                onMove={(direction) => {
                  mutations.reorder(moveHabit(orderedIds, habit.id, direction))
                }}
                onEdit={() => {
                  setEditing(habit)
                  setView('form')
                }}
                onArchive={() => {
                  setConfirmArchiveId(habit.id)
                }}
                onCancelArchive={() => {
                  setConfirmArchiveId(null)
                }}
                onConfirmArchive={() => {
                  setConfirmArchiveId(null)
                  void mutations.archive(habit.id)
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {active.length === 0 ? (
        <p className="text-sm text-text-muted-on-dark">No habits yet. Add the first one.</p>
      ) : null}

      {atLimit ? (
        <p className="text-xs text-text-muted-on-dark">
          That is all 15 habits. Archive one to make room for another.
        </p>
      ) : (
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null)
            setView('form')
          }}
        >
          Add habit
        </Button>
      )}

      {archived.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-dark pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted-on-dark">
            Archived
          </h3>

          <ul className="flex flex-col gap-2">
            {archived.map((habit) => (
              <li
                key={habit.id}
                className="flex items-center gap-2 rounded-sm border border-border-dark px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-text-muted-on-dark">
                  {habit.name}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={mutations.isSaving}
                  onClick={() => {
                    mutations.restore(habit.id)
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end border-t border-border-dark pt-4">
        <Button variant="ghost" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}

/**
 * The dialog itself.
 *
 * The content is passed as a value rather than behind an `open ?` guard, so it
 * is still there while the panel fades out instead of collapsing to its header
 * first. It mounts and unmounts with `open` all the same, because the Modal only
 * renders its children while it is open, which is what gives every open a fresh
 * list and an empty form.
 */
export function HabitManagerModal({ open, onClose, habits, initialView }: HabitManagerModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={initialView === 'add' ? 'Add habit' : 'Habits'}>
      <ManagerContent habits={habits} initialView={initialView} onClose={onClose} />
    </Modal>
  )
}
