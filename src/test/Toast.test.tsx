import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/Button'
import { ToastProvider, ToastViewport } from '@/components/ui/Toast'
import { useToast } from '@/hooks/useToast'
import { TOAST_DURATION_MS } from '@/lib/toast'

interface TriggerProps {
  message?: string
  durationMs?: number
  actionLabel?: string
  onAction?: () => void
}

function Trigger({ message = 'Saved.', durationMs, actionLabel, onAction }: TriggerProps) {
  const { push } = useToast()

  return (
    <Button
      onClick={() => {
        push({
          message,
          ...(durationMs !== undefined ? { durationMs } : {}),
          ...(actionLabel !== undefined ? { actionLabel } : {}),
          ...(onAction !== undefined ? { onAction } : {}),
        })
      }}
    >
      Notify
    </Button>
  )
}

/**
 * Exposes the queue length as text. The toast is removed from context state
 * before AnimatePresence finishes its exit animation, and jsdom never completes
 * that animation, so asserting on the DOM would test framer-motion rather than
 * the timing logic this file is here to check.
 */
function Probe() {
  const { toasts } = useToast()

  return <span data-testid="toast-count">{toasts.length}</span>
}

function renderToasts(props: TriggerProps = {}) {
  return render(
    <ToastProvider>
      <Trigger {...props} />
      <ToastViewport />
      <Probe />
    </ToastProvider>,
  )
}

function toastCount() {
  return Number(screen.getByTestId('toast-count').textContent)
}

/** Fires the trigger without userEvent, which deadlocks against fake timers. */
function triggerWithAct() {
  act(() => {
    screen.getByRole('button', { name: 'Notify' }).click()
  })
}

describe('Toast timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  const advance = async (ms: number) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  it('shows the toast once triggered', () => {
    renderToasts({ message: 'Morning run archived.' })

    triggerWithAct()

    expect(screen.getByText('Morning run archived.')).toBeInTheDocument()
    expect(toastCount()).toBe(1)
  })

  it('auto-dismisses once the duration has elapsed', async () => {
    renderToasts({ message: 'Gone soon.', durationMs: 1000 })

    triggerWithAct()
    expect(toastCount()).toBe(1)

    await advance(999)
    expect(toastCount()).toBe(1)

    await advance(1)
    expect(toastCount()).toBe(0)
  })

  it('does not dismiss before the duration has elapsed', async () => {
    renderToasts({ message: 'Still here.', durationMs: 5000 })

    triggerWithAct()

    await advance(TOAST_DURATION_MS - 1)

    expect(toastCount()).toBe(1)
  })

  it('never dismisses on its own when the duration is zero', async () => {
    renderToasts({ message: 'Sticky.', durationMs: 0 })

    triggerWithAct()

    await advance(TOAST_DURATION_MS * 10)

    expect(toastCount()).toBe(1)
  })

  it('pauses the countdown while hovered and resumes on leave', async () => {
    renderToasts({ message: 'Hover me.', durationMs: 1000 })

    triggerWithAct()

    const toast = screen.getByText('Hover me.').closest('li')
    expect(toast).not.toBeNull()

    // React derives onMouseEnter/onMouseLeave from mouseover and mouseout, so the
    // events have to be dispatched that way rather than as mouseenter.
    act(() => {
      fireEvent.mouseOver(toast as Element)
    })

    // Well past the original duration, but hovering holds it open.
    await advance(5000)
    expect(toastCount()).toBe(1)

    act(() => {
      fireEvent.mouseOut(toast as Element)
    })

    await advance(1000)
    expect(toastCount()).toBe(0)
  })

  it('announces politely rather than interrupting', () => {
    renderToasts({ durationMs: 0 })

    triggerWithAct()

    const region = screen.getByRole('status')

    expect(region).toHaveAttribute('aria-live', 'polite')
  })
})

// These use real timers and real user interaction. Auto-dismiss is switched off
// with durationMs 0 so nothing has to wait out a real countdown.
describe('Toast interaction', () => {
  it('dismisses immediately from the close button', async () => {
    const user = userEvent.setup()
    renderToasts({ message: 'Dismiss me.', durationMs: 0 })

    await user.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByText('Dismiss me.')).toBeInTheDocument()
    expect(toastCount()).toBe(1)

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))

    expect(toastCount()).toBe(0)
  })

  it('runs the action and then dismisses', async () => {
    const onAction = vi.fn()
    const user = userEvent.setup()
    renderToasts({ message: 'Archived.', actionLabel: 'Undo', onAction, durationMs: 0 })

    await user.click(screen.getByRole('button', { name: 'Notify' }))
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    expect(onAction).toHaveBeenCalledTimes(1)
    expect(toastCount()).toBe(0)
  })

  it('queues several toasts and clears them one at a time', async () => {
    const user = userEvent.setup()
    renderToasts({ message: 'First.', durationMs: 0 })

    await user.click(screen.getByRole('button', { name: 'Notify' }))
    await user.click(screen.getByRole('button', { name: 'Notify' }))

    expect(screen.getAllByText('First.')).toHaveLength(2)
    expect(toastCount()).toBe(2)

    await user.click(screen.getAllByRole('button', { name: 'Dismiss notification' })[0]!)

    expect(toastCount()).toBe(1)
  })

  it('throws a useful error when used outside a provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => render(<Trigger />)).toThrow(/ToastProvider/)

    consoleError.mockRestore()
  })
})
