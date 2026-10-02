import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { Tabs, type TabItem } from '@/components/ui/Tabs'

const ITEMS: readonly TabItem[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year', disabled: true },
  { id: 'all', label: 'All' },
]

function Harness({ initial = 'week' }: { initial?: string }) {
  const [value, setValue] = useState(initial)

  return <Tabs items={ITEMS} value={value} onChange={setValue} ariaLabel="Range" />
}

describe('Tabs keyboard navigation', () => {
  it('exposes a tablist with the selected tab', () => {
    render(<Harness />)

    expect(screen.getByRole('tablist', { name: 'Range' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  })

  it('moves to the next tab with ArrowRight', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    screen.getByRole('tab', { name: 'Week' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveFocus()
  })

  it('skips a disabled tab instead of stopping on it', async () => {
    const user = userEvent.setup()
    render(<Harness initial="month" />)

    screen.getByRole('tab', { name: 'Month' }).focus()
    await user.keyboard('{ArrowRight}')

    // "Year" is disabled, so selection lands on "All".
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Year' })).toHaveAttribute('aria-selected', 'false')
  })

  it('skips a disabled tab when moving backwards', async () => {
    const user = userEvent.setup()
    render(<Harness initial="all" />)

    screen.getByRole('tab', { name: 'All' }).focus()
    await user.keyboard('{ArrowLeft}')

    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute('aria-selected', 'true')
  })

  it('wraps from the last tab back to the first', async () => {
    const user = userEvent.setup()
    render(<Harness initial="all" />)

    screen.getByRole('tab', { name: 'All' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  })

  it('jumps to the first and last enabled tab with Home and End', async () => {
    const user = userEvent.setup()
    render(<Harness initial="month" />)

    screen.getByRole('tab', { name: 'Month' }).focus()

    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute('aria-selected', 'true')
  })

  it('marks a disabled tab as disabled', () => {
    render(<Harness />)

    expect(screen.getByRole('tab', { name: 'Year' })).toBeDisabled()
  })

  it('selects a tab on click', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('tab', { name: 'All' }))

    expect(screen.getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
  })
})
