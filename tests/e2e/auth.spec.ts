import { test, expect } from '@playwright/test'
import { USERS, signIn, signInAndLand } from './helpers'

test.describe('authentication', () => {
  test('signed-out visitors are sent to the login page and remember where they were going', async ({ page }) => {
    await page.goto('/patients')
    await expect(page).toHaveURL(/\/login\?redirectTo=%2Fpatients/)
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('the root URL leads signed-out visitors to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('wrong credentials show an error and keep the user on the login page', async ({ page }) => {
    await signIn(page, USERS.adminA, 'not-the-password')
    await expect(page.getByText('Invalid email or password.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('a valid sign-in reaches the dashboard', async ({ page }) => {
    await signInAndLand(page, USERS.adminA)
    await expect(page.getByText('Dashboard')).toBeVisible()
  })

  test('a signed-in user is bounced away from the login page', async ({ page }) => {
    await signInAndLand(page, USERS.adminA)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('signing out ends the session', async ({ page }) => {
    // Own user: signing out revokes all of that user's sessions, which would break parallel tests.
    await signInAndLand(page, USERS.logoutA)
    await page.goto('/logout')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/patients')
    await expect(page).toHaveURL(/\/login/)
  })
})
