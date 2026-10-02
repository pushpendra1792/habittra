import { expect, test } from '@playwright/test'

test('app shell loads without console errors', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Habittra' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})
