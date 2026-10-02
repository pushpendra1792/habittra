import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

function Harness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true)
        }}
      >
        Open dialog
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          onClose?.()
        }}
        title="Archive habit"
        description="The habit stays in your history."
        footer={
          <Button
            onClick={() => {
              setOpen(false)
            }}
          >
            Confirm
          </Button>
        }
      >
        <Button>First action</Button>
        <Button>Second action</Button>
      </Modal>
    </>
  )
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open dialog' }))

  return screen.findByRole('dialog')
}

describe('Modal focus behaviour', () => {
  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openDialog(user)

    await waitFor(() => {
      expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
    })
  })

  it('labels the dialog by its title and marks it modal', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const dialog = await openDialog(user)

    expect(dialog).toHaveAccessibleName('Archive habit')
    expect(dialog).toHaveAccessibleDescription('The habit stays in your history.')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('wraps Tab from the last focusable back to the first', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const dialog = await openDialog(user)

    const focusable = [...dialog.querySelectorAll<HTMLElement>('button')].filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    )

    const first = focusable[0]
    const last = focusable.at(-1)

    expect(first).toBeDefined()
    expect(last).toBeDefined()

    last?.focus()
    await user.tab()

    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first focusable back to the last', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const dialog = await openDialog(user)

    const focusable = [...dialog.querySelectorAll<HTMLElement>('button')].filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    )

    const first = focusable[0]
    const last = focusable.at(-1)

    first?.focus()
    await user.tab({ shift: true })

    expect(document.activeElement).toBe(last)
  })

  it('keeps focus inside the dialog across repeated tabs', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const dialog = await openDialog(user)

    for (let press = 0; press < 6; press += 1) {
      await user.tab()
      expect(dialog.contains(document.activeElement)).toBe(true)
    }
  })

  it('returns focus to the trigger when it closes', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const trigger = await openDialog(user)
    expect(trigger).toBeDefined()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open dialog' }))
  })

  it('locks background scroll while open and restores it after', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(document.body.style.overflow).toBe('')

    await openDialog(user)
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(document.body.style.overflow).toBe('')
    })
  })
})

describe('Modal dismissal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await openDialog(user)
    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    await openDialog(user)

    // The backdrop is the only element carrying the click-to-close handler, so
    // it can be reached by its class rather than by a role.
    const backdrop = [...document.querySelectorAll('div')].find((element) =>
      element.className.includes('backdrop-blur-sm'),
    )

    expect(backdrop).toBeDefined()
    await user.click(backdrop as HTMLElement)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when the panel itself is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)

    const dialog = await openDialog(user)
    await user.click(dialog)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes from the close button', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await openDialog(user)
    await user.click(screen.getByRole('button', { name: 'Close dialog' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => undefined} title="Hidden">
        content
      </Modal>,
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
