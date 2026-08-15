import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import YAML from 'yaml'
import { E2E_HERMES_HOME } from '../../playwright.config'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'

/**
 * G6 e2e —— 飞书/钉钉 webhook 集成设置。
 *
 * webServer 以 HERMES_HOME=<项目>/.e2e-hermes 启动（见 playwright.config.ts），
 * 配置写入项目内临时目录，绝不触碰开发者真实的 ~/.hermes。
 *
 * 覆盖：
 *  - GET  /api/integrations    通道状态 JSON + 网关在线标志
 *  - PUT  /api/integrations    保存配置 → 断言真实 config.yaml 文件生效
 *                              （webhook_url / secret / enabled 字段落盘）
 *  - PUT  secret 语义：留空保留现有值
 *  - POST /api/integrations/test  向本地 webhook 接收端真实投递
 *                                （飞书签名请求头 / 钉钉签名 query 断言）
 *  - 设置页渲染 + reload 三态消息如实展示
 */

const CONFIG_PATH = path.join(E2E_HERMES_HOME, 'config.yaml')

/** 与 settings 页 RELOAD_MESSAGES 一致的三种三态消息（网关离线时展示最后一条） */
const RELOAD_MESSAGES = [
  'Saved. Gateway reloaded — settings are live.',
  'Saved, but gateway reload failed. Restart the gateway to apply.',
  'Saved. Gateway is offline — settings load when it starts.',
]

type SinkRequest = {
  method: string
  url: string
  body: string
  headers: Record<string, string>
}

/**
 * 打开设置页并排除前置导航障碍：
 *  - onboarding 弹窗：localStorage 标记完成
 *  - 连接 splash：e2e 无 gateway，/api/auth-check 返回 503 会永久遮罩 →
 *    mock 成功响应使其在首次轮询后关闭
 */
async function prepareSettingsPage(page: Page) {
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
  await page.goto('/settings')
  await expect(page.locator('body')).toBeVisible()
}

test.describe('Integration webhooks (G6)', () => {
  let sink: Server
  let sinkUrl = ''
  const received: Array<SinkRequest> = []

  test.beforeAll(async () => {
    // 从干净状态开始：
    // 1) rmSync 清空临时 HERMES_HOME（文件锁时 {force:true} 可能静默失败，仅作兜底）
    // 2) API 清空两通道配置 —— 保证 GET 断言确定（无论 server 进程残留与否）
    rmSync(E2E_HERMES_HOME, { recursive: true, force: true })
    mkdirSync(E2E_HERMES_HOME, { recursive: true })
    for (const channel of ['feishu', 'dingtalk']) {
      await fetch('http://127.0.0.1:3000/api/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, settings: null }),
      })
    }

    // 本地 webhook 接收端：模拟飞书/钉钉机器人接口，记录收到的投递
    sink = createServer((req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk.toString('utf-8')))
      req.on('end', () => {
        received.push({
          method: req.method ?? '',
          url: req.url ?? '',
          body,
          headers: req.headers as Record<string, string>,
        })
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 0 }))
      })
    })
    await new Promise<void>((resolve) => sink.listen(0, '127.0.0.1', resolve))
    const port = (sink.address() as AddressInfo).port
    sinkUrl = `http://127.0.0.1:${port}/hook`
  })

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      sink.close((err) => (err ? reject(err) : resolve())),
    )
  })

  test('GET /api/integrations returns channel state JSON', async ({ request }) => {
    const res = await request.get('/api/integrations')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/json')
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.integrations.feishu).toBeDefined()
    expect(data.integrations.dingtalk).toBeDefined()
    expect(typeof data.gateway.online).toBe('boolean')
    // 干净环境下两通道均未配置
    expect(data.integrations.feishu.configured).toBe(false)
    expect(data.integrations.dingtalk.configured).toBe(false)
  })

  test('PUT saves feishu channel and writes real config.yaml', async ({ request }) => {
    const res = await request.put('/api/integrations', {
      data: {
        channel: 'feishu',
        settings: {
          enabled: true,
          webhookUrl: sinkUrl,
          secret: 'feishu-secret-abc123',
        },
      },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)

    // 配置路径必须落在 e2e 临时目录（防御性断言：若误连旧服务端会立刻失败）
    expect(data.configPath).toBe(CONFIG_PATH)
    expect(data.configPath.startsWith(E2E_HERMES_HOME)).toBe(true)

    // 状态如实：已配置 / 启用 / 密钥已设 / 掩码格式
    expect(data.state.configured).toBe(true)
    expect(data.state.enabled).toBe(true)
    expect(data.state.secretSet).toBe(true)
    expect(data.state.secretMasked).toBe('feis...c123')
    expect(data.state.webhookUrlMasked.endsWith('/***')).toBe(true)

    // reload 三态之一（本环境网关离线 → gateway-offline）
    expect(['reloaded', 'reload-failed', 'gateway-offline']).toContain(
      data.reload.status,
    )

    // 真实文件断言：config.yaml 已落盘且字段正确
    expect(existsSync(CONFIG_PATH)).toBe(true)
    const config = YAML.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    expect(config.integrations.feishu.webhook_url).toBe(sinkUrl)
    expect(config.integrations.feishu.secret).toBe('feishu-secret-abc123')
    expect(config.integrations.feishu.enabled).toBe(true)
  })

  test('PUT without secret keeps the existing secret', async ({ request }) => {
    const res = await request.put('/api/integrations', {
      data: {
        channel: 'feishu',
        settings: { enabled: true, webhookUrl: sinkUrl },
      },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.state.secretSet).toBe(true)

    const config = YAML.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    expect(config.integrations.feishu.secret).toBe('feishu-secret-abc123')
  })

  test('POST /api/integrations/test delivers to feishu webhook sink', async ({
    request,
  }) => {
    const before = received.length
    const res = await request.post('/api/integrations/test', {
      data: { channel: 'feishu' },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.delivered).toBe(true)

    expect(received.length).toBe(before + 1)
    const hit = received[received.length - 1]
    expect(hit.method).toBe('POST')
    expect(hit.url).toBe('/hook')
    // 飞书签名经请求头传递
    expect(hit.headers['x-lark-request-timestamp']).toBeTruthy()
    expect(hit.headers['x-lark-signature']).toBeTruthy()
    const payload = JSON.parse(hit.body)
    expect(payload.msg_type).toBe('text')
  })

  test('PUT saves dingtalk channel and writes real config.yaml', async ({ request }) => {
    const res = await request.put('/api/integrations', {
      data: {
        channel: 'dingtalk',
        settings: {
          enabled: true,
          webhookUrl: sinkUrl,
          secret: 'ding-secret-xyz789',
        },
      },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)

    const config = YAML.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    expect(config.integrations.dingtalk.webhook_url).toBe(sinkUrl)
    expect(config.integrations.dingtalk.secret).toBe('ding-secret-xyz789')
    expect(config.integrations.dingtalk.enabled).toBe(true)
  })

  test('POST /api/integrations/test delivers to dingtalk webhook sink', async ({
    request,
  }) => {
    const before = received.length
    const res = await request.post('/api/integrations/test', {
      data: { channel: 'dingtalk' },
    })
    expect(res.status()).toBe(200)
    const data = await res.json()
    expect(data.delivered).toBe(true)

    expect(received.length).toBe(before + 1)
    const hit = received[received.length - 1]
    expect(hit.method).toBe('POST')
    // 钉钉签名经 URL query 传递
    expect(hit.url).toContain('/hook?timestamp=')
    expect(hit.url).toContain('&sign=')
    const payload = JSON.parse(hit.body)
    expect(payload.msgtype).toBe('text')
  })

  test('settings page: configure dingtalk shows reload three-state message', async ({
    page,
    request,
  }) => {
    // 自包含：先经 API 保证 dingtalk 已配置（Edit 流程依赖），
    // 不依赖其他用例的执行顺序
    const put = await request.put('/api/integrations', {
      data: {
        channel: 'dingtalk',
        settings: {
          enabled: true,
          webhookUrl: `${sinkUrl}/dingtalk`,
          secret: 'ding-secret-xyz789',
        },
      },
    })
    expect(put.ok()).toBe(true)

    await prepareSettingsPage(page)

    // 切换到 Integrations tab（默认展示 Model & Provider）
    await page.getByRole('button', { name: 'Integrations' }).first().click()

    const dingCard = page
      .locator('div.rounded-xl', { hasText: 'DingTalk (钉钉)' })
      .first()
    await expect(dingCard).toBeVisible()

    // 已配置 → 走 Edit 进入编辑态
    await dingCard.getByRole('button', { name: 'Edit' }).click()

    // Webhook URL + Sign secret
    await dingCard.locator('input').first().fill(`${sinkUrl}/dingtalk-ui`)
    await dingCard.locator('input').nth(1).fill('ding-secret-xyz789')
    await dingCard.getByRole('button', { name: 'Save' }).click()

    // 等待保存完成：msg 出现（reload 三态消息之一），避免读取编辑态 hint 的竞态
    await expect(dingCard.getByText(/^Saved/)).toBeVisible()
    const msg = (await dingCard.locator('p').last().textContent())?.trim()
    expect(RELOAD_MESSAGES, `reload message was: ${msg}`).toContain(msg)

    // 已配置展示：掩码行 + enabled 徽标 + Test 按钮
    await expect(dingCard.getByText('Webhook', { exact: true })).toBeVisible()
    await expect(dingCard.getByText('Secret', { exact: true })).toBeVisible()
    await expect(dingCard.getByText('enabled')).toBeVisible()
    await expect(dingCard.getByRole('button', { name: 'Test' })).toBeVisible()
  })

  test('settings page: feishu card reflects saved state without crashing', async ({
    page,
    request,
  }) => {
    // 自包含：先经 API 保证 feishu 已配置，不依赖其他用例的执行顺序
    const put = await request.put('/api/integrations', {
      data: {
        channel: 'feishu',
        settings: {
          enabled: true,
          webhookUrl: `${sinkUrl}/feishu`,
          secret: 'feishu-secret-abc123',
        },
      },
    })
    expect(put.ok()).toBe(true)

    await prepareSettingsPage(page)

    // 切换到 Integrations tab
    await page.getByRole('button', { name: 'Integrations' }).first().click()

    const feishuCard = page
      .locator('div.rounded-xl', { hasText: 'Feishu (飞书)' })
      .first()
    await expect(feishuCard).toBeVisible()

    // 已保存 feishu → 掩码 Webhook / Secret 行 + Test / Edit / Remove
    await expect(feishuCard.getByText('Webhook', { exact: true })).toBeVisible()
    await expect(feishuCard.getByText('Secret', { exact: true })).toBeVisible()
    await expect(feishuCard.getByRole('button', { name: 'Test' })).toBeVisible()
    await expect(feishuCard.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(feishuCard.getByRole('button', { name: 'Remove' })).toBeVisible()

    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).not.toBeVisible()
  })
})
