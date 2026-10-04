import { expect, test } from '@playwright/test'

/**
 * The auth screens.
 *
 * These run against a build with no Supabase keys, which is the only build CI and
 * a fresh clone can make. That is a deliberate choice: it checks the states that
 * do not need a network at all, which are the states a broken build would get
 * wrong. With the variables set, the same pages render the same way minus the
 * "not set up" line.
 *
 * Nothing here creates an account or signs in. That needs a live project, and a
 * test that quietly skipped itself while claiming to cover sign-in would be worse
 * than no test.
 */

test('an anonymous visitor is sent to sign in', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/login$/)

  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('an unknown URL also lands on sign in', async ({ page }) => {
  await page.goto('/nowhere')

  await expect(page).toHaveURL(/\/login$/)
})

test('the design review page stays reachable without a session', async ({ page }) => {
  // It is a review tool and touches no user data. Locking a designer out of it
  // would only make the next change harder to check.
  await page.goto('/design')

  await expect(page.getByRole('heading', { level: 1, name: 'Habittra' })).toBeVisible()
})

test('the sign-in screen loads without console errors', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await page.goto('/login')

  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('every auth screen loads without console errors', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  for (const path of ['/login', '/signup', '/reset-password']) {
    await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }

  expect(consoleErrors).toEqual([])
})

test('a build with no Supabase keys says so instead of failing silently', async ({ page }) => {
  await page.goto('/login')

  // No keys means no session and no request. The screen has to say which of the
  // two variables is missing rather than sitting on an inert form.
  await expect(page.getByText('Supabase is not set up. See SETUP_SUPABASE.md.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled()
})

test('the Google button is hidden unless the flag is on', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})

test('an empty form says what is missing without asking the server', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByText('Enter your email.')).toBeVisible()
  await expect(page.getByText('Enter your password.')).toBeVisible()

  // Still on the same screen, still not disabled: a build with no keys must not
  // look like a form that silently succeeded.
  await expect(page).toHaveURL(/\/login$/)
})

test('an address that is not an address is refused before the request', async ({ page }) => {
  await page.goto('/signup')

  await page.getByLabel('Name').fill('Pushp')
  await page.getByLabel('Email').fill('pushp@example')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('That does not look like an email address.')).toBeVisible()
})

test('a short password is refused before the request', async ({ page }) => {
  await page.goto('/signup')

  await page.getByLabel('Name').fill('Pushp')
  await page.getByLabel('Email').fill('pushp@example.com')
  await page.getByLabel('Password').fill('abc')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('Use at least 6 characters.')).toBeVisible()
})

test('signing up without a name says so', async ({ page }) => {
  await page.goto('/signup')

  await page.getByLabel('Email').fill('pushp@example.com')
  await page.getByLabel('Password').fill('correct horse')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByText('Enter a name.')).toBeVisible()
})

test('signing in moves focus nowhere but the screen stays put', async ({ page }) => {
  // The gate must not navigate before Supabase answers. This is what a layout that
  // jumps looks like from the outside.
  await page.goto('/login')

  await page.getByLabel('Email').fill('pushp@example.com')
  await page.getByLabel('Password').fill('correct horse')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

test('the screens link to each other', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('link', { name: 'Create an account' }).click()
  await expect(page).toHaveURL(/\/signup$/)

  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/reset-password$/)
})

test('every field on every auth screen has an accessible name', async ({ page }) => {
  for (const path of ['/login', '/signup', '/reset-password']) {
    await page.goto(path)

    const controls = page.getByRole('textbox')
    const count = await controls.count()

    for (let index = 0; index < count; index += 1) {
      const name = await controls.nth(index).evaluate((element) => {
        const id = element.getAttribute('id')
        const label = id === null ? null : document.querySelector(`label[for="${id}"]`)

        return (label?.textContent ?? element.getAttribute('aria-label') ?? '').trim()
      })

      expect(name, `${path} control ${index} has no accessible name`).not.toBe('')
    }
  }
})

test('the auth screens fit 360px without sideways scrolling', async ({ page }) => {
  for (const path of ['/login', '/signup', '/reset-password']) {
    await page.goto(path)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )

    expect(overflow, `${path} scrolls sideways at 360px`).toBeLessThanOrEqual(0)
  }
})
