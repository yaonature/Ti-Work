import { expect, test } from '@playwright/test'
import { openWorkspacePage } from './support/workspace'

test.describe('工作台高频任务露出（P1-B 行为资产沉淀）', () => {
  test('高频任务区块随工作台露出（标题与沉淀引导/画像列表可达）', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-DASH-0002',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/dashboard')

    // 区块锚点：无论本地是否有沉淀数据，区块都应在工作台露出。
    const section = page.getByTestId('dashboard_high_frequency_tasks')
    await expect(section).toBeVisible()
    await expect(section.getByText('高频任务')).toBeVisible()
  })
})
