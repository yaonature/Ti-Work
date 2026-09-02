import { expect, test } from '@playwright/test'
import { openWorkspacePage } from './support/workspace'

test.describe('桌面端导航收口', () => {
  test('主菜单和底部入口只保留 4+2 结构', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-NAV-0001',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/dashboard')

    const mainMenu = page.getByTestId('desktop_nav_main_menu')
    const bottomMenu = page.getByTestId('desktop_nav_bottom_menu')

    await expect(mainMenu).toBeVisible()
    await expect(bottomMenu).toBeVisible()

    await expect(mainMenu.getByTestId(/desktop_nav_/)).toHaveCount(4)
    await expect(bottomMenu.getByTestId(/desktop_nav_/)).toHaveCount(2)

    await expect(page.getByTestId('desktop_nav_dashboard')).toBeVisible()
    await expect(page.getByTestId('desktop_nav_agents')).toBeVisible()
    await expect(page.getByTestId('desktop_nav_files')).toBeVisible()
    await expect(page.getByTestId('desktop_nav_jobs')).toBeVisible()
    await expect(page.getByTestId('desktop_nav_audit')).toBeVisible()
    await expect(page.getByTestId('desktop_nav_settings')).toBeVisible()
  })
})
