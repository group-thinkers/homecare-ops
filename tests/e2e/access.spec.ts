import { test, expect } from '@playwright/test'
import { USERS, signInAndLand } from './helpers'

test.describe('data isolation and permissions in the browser', () => {
  test('an organization sees its own patients and never another organization\'s', async ({ page }) => {
    await signInAndLand(page, USERS.adminA)
    await page.goto('/patients')
    await expect(page.getByText('Alphapatient')).toBeVisible()
    await expect(page.getByText('Betapatient')).toHaveCount(0)
  })

  test('the other organization sees the mirror image', async ({ page }) => {
    await signInAndLand(page, USERS.adminB)
    await page.goto('/patients')
    await expect(page.getByText('Betapatient')).toBeVisible()
    await expect(page.getByText('Alphapatient')).toHaveCount(0)
  })

  test('a scheduler cannot open user management', async ({ page }) => {
    await signInAndLand(page, USERS.schedulerA)
    await page.goto('/settings/users')
    await expect(page.locator('main').getByText('You are not authorized to view this page.')).toBeVisible()
  })

  test('an administrator can open user management', async ({ page }) => {
    await signInAndLand(page, USERS.adminA)
    await page.goto('/settings/users')
    await expect(page.locator('main').getByText('You are not authorized to view this page.')).toHaveCount(0)
    await expect(page).toHaveURL(/\/settings\/users/)
  })

  test('a patient from another organization cannot be opened by id', async ({ page }) => {
    await signInAndLand(page, USERS.adminA)
    const response = await page.goto('/patients/bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')
    await expect(page.getByText('Betapatient')).toHaveCount(0)
    // Either a 404 or a not-authorized page is acceptable; leaking the record is not.
    expect(response?.status()).toBeLessThan(500)
  })
})
