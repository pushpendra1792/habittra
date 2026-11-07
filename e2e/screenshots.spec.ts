import { expect, test } from '@playwright/test'

/**
 * Design review screenshots.
 *
 * These write into `docs/screenshots/`, so they are a separate run from
 * `npm run test:e2e` and use their own config. That keeps a normal test run from
 * rewriting committed files.
 */
test.use({ deviceScaleFactor: 1 })

test('captures a full-page design review screenshot', async ({ page }, testInfo) => {
  await page.goto('/design')

  await expect(page.getByRole('heading', { level: 1, name: 'Habittra' })).toBeVisible()

  // The trend chart measures its container and animates the line in, so wait for
  // the finished path rather than screenshotting an empty or half-drawn frame.
  await page.locator('.recharts-line-curve').first().waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)

  const path = `docs/screenshots/design-${testInfo.project.name}.png`

  await page.screenshot({ path, fullPage: true, animations: 'disabled' })

  // Recorded so the run output names the file it wrote.
  await testInfo.attach(`design-${testInfo.project.name}`, { path })
})
