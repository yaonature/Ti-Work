import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function prepareWorkspacePage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hermes-onboarding-complete', 'true')
  })

  await page.route('**/api/auth-check', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        authenticated: true,
        authRequired: false,
        multiUser: false,
        currentUser: null,
      }),
    }),
  )
}

export async function openWorkspacePage(page: Page, path: string) {
  await prepareWorkspacePage(page)
  await page.goto(path)
  await expect(page.locator('body')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(page.locator('text=Something went wrong')).not.toBeVisible()
}
