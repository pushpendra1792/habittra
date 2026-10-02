import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '@/App'

describe('test harness', () => {
  it('resolves the @/ alias and renders with jsdom + testing-library', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Habittra' })).toBeInTheDocument()
  })
})
