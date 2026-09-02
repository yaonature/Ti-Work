import { expect, test } from '@playwright/test'
import { openWorkspacePage } from './support/workspace'

test.describe('权限与安全归并', () => {
  test('权限与安全页内可切换 4 个治理分区', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-SEC-0001',
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/audit')

    await expect(page.getByTestId('security_center_page')).toBeVisible()
    await expect(page.getByTestId('security_center_tab_permissions')).toBeVisible()
    await expect(page.getByTestId('security_center_tab_audit')).toBeVisible()
    await expect(page.getByTestId('security_center_tab_account')).toBeVisible()
    await expect(page.getByTestId('security_center_tab_hub')).toBeVisible()

    // 默认落在「授权配置」tab
    await expect(page.getByTestId('security_center_panel_permissions')).toBeVisible()

    await page.getByTestId('security_center_tab_audit').click()
    await expect(page.getByTestId('security_center_panel_audit')).toBeVisible()

    await page.getByTestId('security_center_tab_account').click()
    await expect(page.getByTestId('security_center_panel_account')).toBeVisible()

    await page.getByTestId('security_center_tab_hub').click()
    await expect(page.getByTestId('security_center_panel_hub')).toBeVisible()
  })

  test('未配置提醒可逐项点击进入对应授权配置', async ({ page }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-PERM-0002',
    })

    // 构造「目录 / 网站 / 风险动作」三项均未配置的状态，用于触发顶部提醒条。
    // 注意：payload 必须携带 providers / activeXxx 等完整字段，
    // HermesConfigSection 会急切渲染所有视图（含依赖 data.providers 的区块），
    // 缺失 providers 会导致整页渲染崩溃（Cannot read properties of undefined (reading 'filter')）。
    const unconfiguredPayload = {
      config: {
        security: {
          directory_access: {
            enabled: true,
            mode: 'scoped',
            allowed_paths: [],
            readonly_paths: [],
            blocked_paths: [],
          },
          website_access: {
            enabled: true,
            mode: 'allowlist',
            allowed_domains: [],
            blocked_domains: [],
          },
          website_blocklist: { enabled: false, domains: [] },
          risk_controls: { require_confirmation: {}, require_approval: {} },
        },
        approvals: { mode: 'manual', timeout: 60 },
        toolsets: ['hermes-web'],
        command_allowlist: ['git'],
        code_execution: { timeout: 300, max_tool_calls: 50 },
      },
      providers: [],
      activeProvider: '',
      activeModel: '',
      hermesHome: '.e2e-hermes',
    }

    await page.route('**/api/hermes-config', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(unconfiguredPayload),
        })
        return
      }
      await route.continue()
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/audit')

    // 提醒条出现，并提示 3 项尚未配置、列出全部未配置领域
    await expect(page.getByTestId('security_center_incomplete_alert')).toBeVisible()
    await expect(
      page.getByTestId('security_center_incomplete_alert'),
    ).toContainText('3 项授权尚未配置')
    await expect(page.getByTestId('security_incomplete_item_directory')).toBeVisible()
    await expect(page.getByTestId('security_incomplete_item_website')).toBeVisible()
    await expect(page.getByTestId('security_incomplete_item_risk')).toBeVisible()

    // 点击「网站访问」→ 进入授权配置 tab 并切到「网站」子 tab
    await page.getByTestId('security_incomplete_item_website').click()
    await expect(page.getByTestId('security_center_panel_permissions')).toBeVisible()
    await expect(page.getByTestId('permissions_website_blocklist_panel')).toBeVisible()

    // 点击「风险动作」→ 定位到「风险动作」子 tab
    await page.getByTestId('security_incomplete_item_risk').click()
    await expect(page.getByTestId('permissions_danger_actions_panel')).toBeVisible()
  })
})
