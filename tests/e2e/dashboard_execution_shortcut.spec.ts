import { expect, test } from '@playwright/test'
import { openWorkspacePage } from './support/workspace'

test.describe('工作台执行中心快捷入口', () => {
  test('工作台快捷入口进入执行中心而不是旧终端心智', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-DASH-0001',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/dashboard')

    const executionCenterShortcut = page.getByTestId(
      'dashboard_quick_action_execution_center',
    )
    await expect(executionCenterShortcut).toBeVisible()
    await executionCenterShortcut.click()

    await expect(page).toHaveURL(/\/files$/)
    await expect(page.getByTestId('execution_center_page')).toBeVisible()
  })
})
