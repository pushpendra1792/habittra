import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { NumberInput } from '@/components/ui/NumberInput'

function Harness({
  initial = 5,
  min = 0,
  max = 10,
  step = 1,
}: {
  initial?: number
  min?: number
  max?: number
  step?: number
}) {
  const [value, setValue] = useState(initial)

  return (
    <NumberInput
      label="Weekly goal"
      value={value}
      onValueChange={setValue}
      min={min}
      max={max}
      step={step}
    />
  )
}

describe('NumberInput bounds', () => {
  it('steps up and down with the steppers', async () => {
    const user = userEvent.setup()
    render(<Harness initial={5} />)

    await user.click(screen.getByRole('button', { name: 'Increase Weekly goal' }))
    expect(screen.getByLabelText('Weekly goal')).toHaveValue(6)

    await user.click(screen.getByRole('button', { name: 'Decrease Weekly goal' }))
    expect(screen.getByLabelText('Weekly goal')).toHaveValue(5)
  })

  it('disables the increment stepper at the maximum', () => {
    render(<Harness initial={10} max={10} />)

    expect(screen.getByRole('button', { name: 'Increase Weekly goal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease Weekly goal' })).toBeEnabled()
  })

  it('disables the decrement stepper at the minimum', () => {
    render(<Harness initial={0} min={0} />)

    expect(screen.getByRole('button', { name: 'Decrease Weekly goal' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Increase Weekly goal' })).toBeEnabled()
  })

  it('will not step past the maximum', async () => {
    const user = userEvent.setup()
    render(<Harness initial={9} max={10} step={5} />)

    await user.click(screen.getByRole('button', { name: 'Increase Weekly goal' }))

    expect(screen.getByLabelText('Weekly goal')).toHaveValue(10)
  })

  it('will not step below the minimum', async () => {
    const user = userEvent.setup()
    render(<Harness initial={1} min={0} step={5} />)

    await user.click(screen.getByRole('button', { name: 'Decrease Weekly goal' }))

    expect(screen.getByLabelText('Weekly goal')).toHaveValue(0)
  })

  it('honours a step of more than one', async () => {
    const user = userEvent.setup()
    render(<Harness initial={10} max={100} step={5} />)

    await user.click(screen.getByRole('button', { name: 'Increase Weekly goal' }))

    expect(screen.getByLabelText('Weekly goal')).toHaveValue(15)
  })

  it('lets the user finish typing an out-of-range value, then snaps it on blur', async () => {
    const user = userEvent.setup()
    render(<Harness initial={5} max={10} />)

    const field = screen.getByLabelText('Weekly goal')
    await user.clear(field)
    await user.type(field, '999')

    // Still what was typed, so the keystrokes are not fought.
    expect(field).toHaveValue(999)

    await user.tab()

    // Now clamped back into range.
    expect(field).toHaveValue(10)
  })

  it('lets the user finish typing a negative value, then snaps it on blur', async () => {
    const user = userEvent.setup()
    render(<Harness initial={5} min={2} />)

    const field = screen.getByLabelText('Weekly goal')
    await user.clear(field)
    await user.type(field, '-40')

    expect(field).toHaveValue(-40)

    await user.tab()

    expect(field).toHaveValue(2)
  })

  it('exposes the bounds to the browser for stepper-free input', () => {
    render(<Harness initial={5} min={2} max={8} />)

    const field = screen.getByLabelText('Weekly goal')

    expect(field).toHaveAttribute('min', '2')
    expect(field).toHaveAttribute('max', '8')
  })

  it('disables both steppers when the whole field is disabled', () => {
    render(
      <NumberInput
        label="Locked"
        value={5}
        onValueChange={() => undefined}
        min={0}
        max={10}
        disabled
      />,
    )

    expect(screen.getByRole('button', { name: 'Increase Locked' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decrease Locked' })).toBeDisabled()
    expect(screen.getByLabelText('Locked')).toBeDisabled()
  })
})
