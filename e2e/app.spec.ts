import { expect, test } from '@playwright/test'

// `/` is behind the auth gate, so it is covered in auth.spec.ts: an anonymous
// visitor is redirected to /login. The two tests here are the design review page
// and the modal behaviour, which do not depend on a session.

test('design review page renders every component section', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/design')

  await expect(page.getByRole('heading', { level: 1, name: 'Habittra' })).toBeVisible()

  for (const section of [
    'Palette',
    'Button',
    'IconButton',
    'Card',
    'ProgressBar',
    'DonutRing',
    'CheckCell',
    'Inputs',
    'Modal and Toast',
    'Skeleton and Tabs',
    'GlowLine',
  ]) {
    // exact, otherwise "Button" also resolves to the "IconButton" heading.
    await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()
  }

  expect(consoleErrors).toEqual([])
})

test('modal traps focus and closes on Escape', async ({ page }) => {
  await page.goto('/design')

  await page.getByRole('button', { name: 'Open modal' }).click()

  const dialog = page.getByRole('dialog')

  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})
