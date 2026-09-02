import { expect, test } from '@playwright/test'
import { openWorkspacePage } from './support/workspace'

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      target[key] = value
    }
  }
}

test.describe('权限中心配置露出', () => {
  test('权限与安全页支持用简洁 Tab 配置目录、站点和高风险动作', async ({
    page,
  }) => {
    test.info().annotations.push({
      type: 'caseId',
      description: 'UI-DESK-PERM-0001',
    })

    let lastPatch: Record<string, unknown> | null = null
    const hermesConfigPayload = {
      config: {
        security: {
          directory_access: {
            enabled: true,
            mode: 'scoped',
            workspace_root: 'D:\\Workspace',
            allowed_paths: ['D:\\Workspace'],
            readonly_paths: ['D:\\ReadOnly'],
            blocked_paths: ['C:\\Windows'],
            require_confirmation_for_write: true,
            require_confirmation_for_delete: true,
          },
          website_access: {
            enabled: true,
            mode: 'balanced',
            allowed_domains: ['oa.lawfirm.com'],
            blocked_domains: ['mail.qq.com'],
          },
          website_blocklist: {
            enabled: true,
            domains: ['mail.qq.com'],
          },
          risk_controls: {
            require_confirmation: {
              delete: true,
              overwrite: true,
              external_send: true,
            },
            require_approval: {
              external_send: false,
            },
          },
          redact_secrets: true,
          tirith_enabled: true,
        },
        approvals: {
          mode: 'manual',
          timeout: 60,
        },
        toolsets: ['hermes-web'],
        command_allowlist: ['git'],
        code_execution: {
          timeout: 300,
          max_tool_calls: 50,
        },
      },
      providers: [],
      activeProvider: '',
      activeModel: '',
      hermesHome: 'D:\\.test-hermes-home',
    }

    await page.route('**/api/hermes-config', async (route) => {
      const request = route.request()
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(hermesConfigPayload),
        })
        return
      }

      if (request.method() === 'PATCH') {
        lastPatch = request.postDataJSON() as Record<string, unknown>
        const patchConfig =
          lastPatch &&
          typeof lastPatch.config === 'object' &&
          lastPatch.config &&
          !Array.isArray(lastPatch.config)
            ? (lastPatch.config as Record<string, unknown>)
            : {}
        deepMerge(hermesConfigPayload.config as Record<string, unknown>, patchConfig)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            message: '配置已更新，重启 Ti Work 后生效。',
          }),
        })
        return
      }

      await route.continue()
    })

    await page.setViewportSize({ width: 1440, height: 960 })
    await openWorkspacePage(page, '/audit')
    await page.getByTestId('security_center_tab_permissions').click()

    // 默认呈现三步式安全向导，需展开「高级设置」进入明细 Tab
    await expect(page.getByTestId('security_advanced_toggle')).toBeVisible()
    await page.getByTestId('security_advanced_toggle').click()
    await expect(page.getByTestId('permissions_tab_directory')).toBeVisible()
    await expect(page.getByTestId('permissions_directory_rules')).toBeVisible()

    // 新增一条「可读写」目录规则
    await page
      .getByTestId('permissions_directory_add_path')
      .fill('D:\\LawFirm\\Cases')
    await page.getByTestId('permissions_directory_add_btn').click()

    await expect
      .poll(() => {
        const config = lastPatch?.config as Record<string, unknown> | undefined
        const security = config?.security as Record<string, unknown> | undefined
        const directoryAccess = security?.directory_access as
          | Record<string, unknown>
          | undefined
        return Array.isArray(directoryAccess?.allowed_paths)
          ? (directoryAccess?.allowed_paths as Array<string>).join('|')
          : ''
      })
      .toContain('D:\\LawFirm\\Cases')

    // 新增一条「只读」目录规则
    await page
      .getByTestId('permissions_directory_add_path')
      .fill('D:\\LawFirm\\Archive')
    await page.getByTestId('permissions_directory_add_level_readonly').click()
    await page.getByTestId('permissions_directory_add_btn').click()

    await expect
      .poll(() => {
        const config = lastPatch?.config as Record<string, unknown> | undefined
        const security = config?.security as Record<string, unknown> | undefined
        const directoryAccess = security?.directory_access as
          | Record<string, unknown>
          | undefined
        return Array.isArray(directoryAccess?.readonly_paths)
          ? (directoryAccess?.readonly_paths as Array<string>).join('|')
          : ''
      })
      .toContain('D:\\LawFirm\\Archive')

    // 切到「网站」Tab，配置拦截站点
    await page.getByTestId('permissions_tab_website').click()
    await expect(page.getByTestId('permissions_website_blocklist_panel')).toBeVisible()
    await page
      .getByTestId('permissions_website_blocklist_input')
      .fill('review.example.com')
    await page.getByTestId('permissions_website_blocklist_add').click()

    await expect
      .poll(() => {
        const config = lastPatch?.config as Record<string, unknown> | undefined
        const security = config?.security as Record<string, unknown> | undefined
        const websiteAccess = security?.website_access as
          | Record<string, unknown>
          | undefined
        return Array.isArray(websiteAccess?.blocked_domains)
          ? (websiteAccess?.blocked_domains as Array<string>).join('|')
          : ''
      })
      .toContain('review.example.com')

    // 切到「风险动作」Tab，开启对外发送审批
    await page.getByTestId('permissions_tab_risk').click()
    await expect(page.getByTestId('permissions_danger_actions_panel')).toBeVisible()
    await page
      .getByTestId('permissions_danger_action_external_send_approval')
      .click()

    await expect
      .poll(() => {
        const config = lastPatch?.config as Record<string, unknown> | undefined
        const security = config?.security as Record<string, unknown> | undefined
        const riskControls = security?.risk_controls as
          | Record<string, unknown>
          | undefined
        const requireApproval = riskControls?.require_approval as
          | Record<string, unknown>
          | undefined
        return Boolean(requireApproval?.external_send)
      })
      .toBe(true)
  })
})
