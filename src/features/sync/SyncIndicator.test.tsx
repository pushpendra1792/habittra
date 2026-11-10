import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SyncContextValue } from './syncContext'
import { SyncContext } from './syncContext'
import { SyncIndicator } from './SyncIndicator'

function renderIndicator(overrides: Partial<SyncContextValue> = {}) {
  const value: SyncContextValue = {
    ready: true,
    status: 'synced',
    pendingCount: 0,
    failedCount: 0,
    enqueue: () => Promise.resolve(),
    retry: vi.fn(),
    ...overrides,
  }

  render(
    <SyncContext.Provider value={value}>
      <SyncIndicator />
    </SyncContext.Provider>,
  )

  return value
}

describe('SyncIndicator', () => {
  it('says synced when there is nothing waiting', () => {
    renderIndicator()

    expect(screen.getByRole('status')).toHaveTextContent('Synced')
  })

  it('says syncing while a replay is running', () => {
    renderIndicator({ status: 'syncing' })

    expect(screen.getByRole('status')).toHaveTextContent('Syncing')
  })

  it('shows the number of pending changes while offline', () => {
    renderIndicator({ status: 'offline', pendingCount: 5 })

    expect(screen.getByRole('status')).toHaveTextContent('Offline · 5')
  })

  it('offers one retry action for an error', () => {
    const value = renderIndicator({ status: 'error', failedCount: 2 })

    const retry = screen.getByRole('button', { name: 'Retry sync, 2 failed changes' })
    fireEvent.click(retry)

    expect(value.retry).toHaveBeenCalledTimes(1)
  })
})
