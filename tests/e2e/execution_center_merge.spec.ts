import { expect, test } from '@playwright/test'
import { openWorkspacePage, prepareWorkspacePage } from './support/workspace'

test.describe('执行中心归并', () => {
  test('执行中心在一个页面内切换文件处理和执行终端', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-EXEC-0001',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/files')

    await expect(page.getByTestId('execution_center_page')).toBeVisible()
    await expect(page.getByTestId('execution_center_tab_workspace')).toBeVisible()
    await expect(page.getByTestId('execution_center_tab_terminal')).toBeVisible()
    await expect(page.getByTestId('execution_center_workspace_view')).toBeVisible()
    await expect(page.getByTestId('execution_center_terminal_view')).toHaveCount(0)

    await page.getByTestId('execution_center_tab_terminal').click()
    await expect(page).toHaveURL(/\/files\?view=terminal$/)
    await expect(page.getByTestId('execution_center_terminal_view')).toBeVisible()
    await expect(page.getByTestId('execution_center_terminal_workspace')).toBeVisible()

    await page.getByTestId('execution_center_tab_workspace').click()
    await expect(page).toHaveURL(/\/files$/)
    await expect(page.getByTestId('execution_center_workspace_view')).toBeVisible()
  })

  test('旧终端路由统一回流到执行中心终端视图', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-EXEC-0002',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await prepareWorkspacePage(page)
    await page.goto('/terminal')

    await expect(page).toHaveURL(/\/files\?view=terminal$/)
    await expect(page.getByTestId('execution_center_terminal_view')).toBeVisible()
  })
})
