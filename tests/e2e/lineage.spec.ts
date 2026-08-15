import { expect, test } from '@playwright/test'

/**
 * G4 e2e —— 管理驾驶舱（/lineage）看板交互冒烟。
 *
 * 覆盖：
 *  - 页面加载不崩溃（无 React error boundary）
 *  - /api/lineage/summary 返回合法 JSON（单用户模式 owner 放行 → 200；
 *    多用户/受保护模式可能 401/403，均属合法服务器响应）
 *  - 任务下拉可见，选择任务触发血缘链查询（页面无崩溃）
 */
test.describe('Lineage dashboard', () => {
  test('lineage page renders without crashing', async ({ page }) => {
    await page.goto('/lineage')
    await expect(page.locator('body')).toBeVisible()
    await page.waitForTimeout(1000)
    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })

  test('/api/lineage/summary returns a JSON response', async ({ request }) => {
    const res = await request.get('/api/lineage/summary')
    expect([200, 401, 403]).toContain(res.status())
    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('application/json')
  })

  test('task selector triggers lineage chain query without crashing', async ({
    page,
  }) => {
    await page.goto('/lineage')
    await expect(page.locator('body')).toBeVisible()

    // 若存在任务下拉（有血缘数据），选择首个任务应触发链查询而不崩溃
    const selector = page.locator('select')
    const count = await selector.count()
    if (count > 0) {
      await selector.first().selectOption({ index: 0 })
      await page.waitForTimeout(500)
    }
    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })
})
