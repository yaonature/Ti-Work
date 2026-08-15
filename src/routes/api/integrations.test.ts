/**
 * G6 集成测试消息 API —— POST /api/integrations/test。
 *
 * 读取已保存的通道配置（~/.hermes/config.yaml `integrations` 段），
 * 携带官方签名（飞书请求头 / 钉钉 URL query）向 webhook 发送一条测试消息。
 */
import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '../../server/auth-middleware'
import {
  getChannelSettings,
  getConfigPath,
  readConfigFile,
} from '../../server/integrations'
import { sendTestWebhook } from '../../server/webhook-delivery'
import type { IntegrationChannel } from '../../server/integrations'

function parseChannel(value: unknown): IntegrationChannel | null {
  return value === 'feishu' || value === 'dingtalk' ? value : null
}

export const Route = createFileRoute('/api/integrations/test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard
        const body = (await request.json()) as Record<string, unknown>
        const channel = parseChannel(body.channel)
        if (!channel) {
          return Response.json(
            { ok: false, message: '无效的频道' },
            { status: 400 },
          )
        }

        const config = readConfigFile(getConfigPath())
        const settings = getChannelSettings(config, channel)
        if (!settings || !settings.webhookUrl) {
          return Response.json(
            { ok: false, message: `通道 ${channel} 未配置` },
            { status: 400 },
          )
        }

        const result = await sendTestWebhook({
          channel,
          webhookUrl: settings.webhookUrl,
          secret: settings.secret,
          fetcher: async (url, init) => {
            try {
              const res = await fetch(url, {
                method: init.method,
                headers: init.headers,
                body: init.body,
              })
              return { ok: res.ok, status: res.status }
            } catch {
              return { ok: false, status: 0 }
            }
          },
        })

        return Response.json({
          ok: result.ok,
          delivered: result.ok,
          status: result.status,
          message: result.ok
            ? `测试消息已发送到 ${channel}`
            : `发送失败（http ${result.status || 'timeout/network'}）`,
        })
      },
    },
  },
})
