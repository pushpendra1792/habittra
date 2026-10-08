/**
 * Where the arrow keys go in the habit grid.
 *
 * The grid is a two dimensional table of buttons, and a keyboard user moves
 * through it with the arrow keys rather than by tabbing through every cell in
 * the month. Which cell comes next is a pure question of position, so it is
 * answered by a pure function: the component supplies the bounds and a predicate
 * for whether a cell can take focus, and this walks in the chosen direction.
 *
 * Disabled cells are stepped over rather than stopped at. Future days are not
 * focusable at all, so stopping on the first one would end navigation at
 * today's edge for no reason a user could see.
 */

export interface Cell {
  row: number
  col: number
}

export type CellDirection = 'up' | 'down' | 'left' | 'right'

const STEPS: Record<CellDirection, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
}

/**
 * The first cell in `direction` from `from` that `canFocus` accepts, or `null`
 * when the walk leaves the grid.
 *
 * The walk stops as soon as it steps outside the bounds, so it never wraps from
 * the last row to the first or from day 31 back to day 1: a table does not wrap,
 * and a focus ring that jumps across the screen reads as a bug.
 */
export function findFocusableCell(
  from: Cell,
  direction: CellDirection,
  rows: number,
  cols: number,
  canFocus: (cell: Cell) => boolean,
): Cell | null {
  const step = STEPS[direction]
  let row = from.row + step.row
  let col = from.col + step.col

  while (row >= 0 && row < rows && col >= 0 && col < cols) {
    const cell = { row, col }

    if (canFocus(cell)) {
      return cell
    }

    row += step.row
    col += step.col
  }

  return null
}
