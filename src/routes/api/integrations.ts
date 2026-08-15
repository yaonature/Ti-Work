/**
 * G6 集成设置 API —— 飞书/钉钉 webhook 配置。
 *
 * GET   /api/integrations       通道状态（掩码）+ 网关在线状态
 * PUT   /api/integrations       写入/更新/删除通道配置 → 触发网关重载
 * POST  /api/integrations/test  向通道发送一条测试消息（见 integrations.test.ts）
 *
 * 配置持久化到 ~/.hermes/config.yaml 的 `integrations` 段；
 * 网关重载结果三态如实上报（reloaded / reload-failed / gateway-offline）。
 */
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth, requireRole } from '../../server/auth-middleware'
import { HERMES_API } from '../../server/gateway-capabilities'
import { reloadGatewayConfig } from '../../server/gateway-reload'
import {
  getChannelSettings,
  getConfigPath,
  normalizeWebhookUrl,
  readConfigFile,
  setChannelSettings,
  toChannelState,
  writeConfigFile,
} from '../../server/integrations'
import type { ChannelSettings, IntegrationChannel } from '../../server/integrations'

const CONFIG_PATH = getConfigPath()

const CHANNELS: Array<IntegrationChannel> = ['feishu', 'dingtalk']
const RELOAD_ENDPOINTS = ['/api/config/reload', '/config/reload']
const PROBE_TIMEOUT_MS = 3000

async function gatewayOnline(): Promise<boolean> {
  try {
    const res = await fetch(`${HERMES_API}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

async function reloadAfterWrite(): Promise<{
  status: 'reloaded' | 'reload-failed' | 'gateway-offline'
  detail: string
}> {
  const result = await reloadGatewayConfig({
    baseUrl: HERMES_API,
    reloadEndpoints: RELOAD_ENDPOINTS,
    probe: async () => gatewayOnline(),
    reloadRequest: async (url) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
        return { ok: res.ok, status: res.status }
      } catch {
        return { ok: false, status: 0 }
      }
    },
  })
  return result
}

function parseChannel(value: unknown): IntegrationChannel | null {
  return value === 'feishu' || value === 'dingtalk' ? value : null
}

export const Route = createFileRoute('/api/integrations')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard
        const config = readConfigFile(CONFIG_PATH)
        const integrations = {} as Record<string, unknown>
        for (const channel of CHANNELS) {
          integrations[channel] = toChannelState(
            getChannelSettings(config, channel),
          )
        }
        const online = await gatewayOnline()
        return Response.json({
          ok: true,
          integrations,
          gateway: { online },
        })
      },

      PUT: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard
        const body = (await request.json()) as Record<string, unknown>
        const channel = parseChannel(body.channel)
        if (!channel) {
          return Response.json({ ok: false, message: '无效的频道' }, { status: 400 })
        }

        const current = readConfigFile(CONFIG_PATH)

        let next: ChannelSettings | null
        if (body.settings === null) {
          next = null
        } else {
          const raw = body.settings as Record<string, unknown>
          const webhookUrl = normalizeWebhookUrl(String(raw.webhookUrl || ''))
          if (!webhookUrl) {
            return Response.json(
              { ok: false, message: 'webhookUrl 必填' },
              { status: 400 },
            )
          }
          // secret 语义：显式 null 清空；未提供或空串保留现有值（避免前端误清）
          const existing = getChannelSettings(current, channel)
          let secret = ''
          if (raw.secret === null) {
            secret = ''
          } else if (raw.secret !== undefined && raw.secret !== '') {
            secret = String(raw.secret)
          } else {
            secret = existing?.secret ?? ''
          }
          next = {
            enabled: raw.enabled === true,
            webhookUrl,
            secret,
          }
        }
        const updated = setChannelSettings(current, channel, next)
        writeConfigFile(CONFIG_PATH, updated)

        const reload = await reloadAfterWrite()
        const state = toChannelState(getChannelSettings(updated, channel))
        return Response.json({
          ok: true,
          channel,
          state,
          reload,
          configPath: CONFIG_PATH,
        })
      },
    },
  },
})
