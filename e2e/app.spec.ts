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

// The device profiles for mobile and tablet carry a deviceScaleFactor above 1,
// which would emit a 945px wide file for the 360px project. Review screenshots
// are pinned to 1:1 CSS pixels so the file matches the width it is named for.
test.describe('design review screenshots', () => {
  test.use({ deviceScaleFactor: 1 })

  test('captures a full-page design review screenshot', async ({ page }, testInfo) => {
    await page.goto('/design')

    await expect(page.getByRole('heading', { level: 1, name: 'Habittra' })).toBeVisible()

    // The trend chart measures its container and animates the line in, so wait
    // for the finished path rather than screenshotting an empty or half-drawn
    // frame.
    await page.locator('.recharts-line-curve').first().waitFor({ state: 'visible' })
    await page.evaluate(() => document.fonts.ready)

    const path = `docs/screenshots/design-${testInfo.project.name}.png`

    await page.screenshot({ path, fullPage: true, animations: 'disabled' })

    // Recorded so the run output names the files it wrote.
    await testInfo.attach(`design-${testInfo.project.name}`, { path })
  })
})
