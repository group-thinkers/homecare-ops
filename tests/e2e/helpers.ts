import { expect, type Page } from '@playwright/test'

export const PASSWORD = 'e2e-Password-1!'

export const USERS = {
  adminA: 'admin-a@e2e.test',
  schedulerA: 'scheduler-a@e2e.test',
  adminB: 'admin-b@e2e.test',
  logoutA: 'logout-a@e2e.test',
} as const

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function signInAndLand(page: Page, email: string) {
  await signIn(page, email)
  await expect(page).toHaveURL(/\/dashboard/)
}
