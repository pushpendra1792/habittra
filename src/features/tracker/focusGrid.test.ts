import { describe, expect, it } from 'vitest'

import { defaultAnchor, findFocusableCell } from './focusGrid'

const allFocusable = () => true

describe('findFocusableCell', () => {
  it('moves one cell in the chosen direction', () => {
    expect(findFocusableCell({ row: 1, col: 1 }, 'right', 3, 5, allFocusable)).toEqual({
      row: 1,
      col: 2,
    })
    expect(findFocusableCell({ row: 1, col: 1 }, 'left', 3, 5, allFocusable)).toEqual({
      row: 1,
      col: 0,
    })
    expect(findFocusableCell({ row: 1, col: 1 }, 'down', 3, 5, allFocusable)).toEqual({
      row: 2,
      col: 1,
    })
    expect(findFocusableCell({ row: 1, col: 1 }, 'up', 3, 5, allFocusable)).toEqual({
      row: 0,
      col: 1,
    })
  })

  it('returns null at the edge instead of wrapping around', () => {
    expect(findFocusableCell({ row: 0, col: 2 }, 'up', 3, 5, allFocusable)).toBeNull()
    expect(findFocusableCell({ row: 2, col: 2 }, 'down', 3, 5, allFocusable)).toBeNull()
    expect(findFocusableCell({ row: 1, col: 0 }, 'left', 3, 5, allFocusable)).toBeNull()
    expect(findFocusableCell({ row: 1, col: 4 }, 'right', 3, 5, allFocusable)).toBeNull()
  })

  it('steps over a cell that cannot take focus', () => {
    // Future days are disabled. Arrow right from the last editable day stops
    // at today's edge only when everything ahead is disabled.
    const enabled = (cell: { col: number }) => cell.col <= 3

    expect(findFocusableCell({ row: 0, col: 1 }, 'right', 2, 7, enabled)).toEqual({
      row: 0,
      col: 2,
    })
    expect(findFocusableCell({ row: 0, col: 3 }, 'right', 2, 7, enabled)).toBeNull()
    expect(findFocusableCell({ row: 0, col: 5 }, 'left', 2, 7, enabled)).toEqual({
      row: 0,
      col: 3,
    })
  })

  it('does not jump to another row while walking sideways', () => {
    // A row where every cell is disabled: sideways navigation must give up
    // rather than fall through to the row below.
    const none = () => false

    expect(findFocusableCell({ row: 0, col: 2 }, 'right', 3, 5, none)).toBeNull()
    expect(findFocusableCell({ row: 0, col: 2 }, 'down', 3, 5, none)).toBeNull()
  })

  it('answers for a single row and a single column', () => {
    expect(findFocusableCell({ row: 0, col: 0 }, 'right', 1, 1, allFocusable)).toBeNull()
    expect(findFocusableCell({ row: 0, col: 0 }, 'down', 1, 1, allFocusable)).toBeNull()
  })

  it('gives up when the grid is empty', () => {
    expect(findFocusableCell({ row: 0, col: 0 }, 'right', 0, 0, allFocusable)).toBeNull()
  })
})

describe('defaultAnchor', () => {
  const october = Array.from(
    { length: 31 },
    (_, index) => `2026-10-${String(index + 1).padStart(2, '0')}`,
  )

  it('lands on today when today is in the month', () => {
    expect(defaultAnchor(october, '2026-10-09')).toEqual({ row: 0, col: 8 })
    expect(defaultAnchor(october, '2026-10-01')).toEqual({ row: 0, col: 0 })
    expect(defaultAnchor(october, '2026-10-31')).toEqual({ row: 0, col: 30 })
  })

  it('lands on the last day of a month that has passed', () => {
    expect(defaultAnchor(october, '2026-11-02')).toEqual({ row: 0, col: 30 })
    expect(defaultAnchor(october, '2027-01-01')).toEqual({ row: 0, col: 30 })
  })

  it('lands on the first day of a month that has not started', () => {
    expect(defaultAnchor(october, '2026-09-30')).toEqual({ row: 0, col: 0 })
  })

  it('answers for February and for an empty list', () => {
    expect(defaultAnchor(['2024-02-01', '2024-02-29'], '2024-02-29')).toEqual({ row: 0, col: 1 })
    expect(defaultAnchor([], '2026-10-09')).toEqual({ row: 0, col: 0 })
  })
})
