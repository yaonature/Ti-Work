/**
 * 企业中枢接入 API（G8）—— 桌面端连接状态 / 连接 / 断开 / 心跳 / 补报。
 *
 * GET  /api/hub/status      → 接入状态（配置/连接/许可证/outbox 深度）
 * POST /api/hub/connect     → 中枢登录（许可证校验 + 席位获取 + 功能集下发）
 * POST /api/hub/disconnect  → 断开（清空状态，席位由中枢 TTL 回收）
 * POST /api/hub/heartbeat   → 手动续租（UI/运维触发）
 * POST /api/hub/flush       → 手动触发离线事件补报
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../server/auth-middleware'
import {
  connectHub,
  disconnectHub,
  flushHubOutbox,
  hubStatus,
  runHubHeartbeat,
} from '../../server/hub-client'
import { registerLineageHubForwarder } from '../../server/hub-forward'

// 启动即注册本地血缘 → 中枢转发（routeTree 静态导入保证服务端启动时执行）
registerLineageHubForwarder()

const ConnectSchema = z.object({
  baseUrl: z.string().trim().min(1).max(500),
  tenantId: z.string().trim().min(1).max(128),
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
  deviceId: z.string().trim().max(128).optional(),
})

export const Route = createFileRoute('/api/hub')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard
        return json({ ok: true, status: hubStatus() })
      },

      POST: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        const url = new URL(request.url)
        const action = url.searchParams.get('action') ?? 'connect'

        if (action === 'disconnect') {
          disconnectHub()
          return json({ ok: true, status: hubStatus() })
        }
        if (action === 'heartbeat') {
          const ok = await runHubHeartbeat()
          return json({ ok, status: hubStatus() })
        }
        if (action === 'flush') {
          const result = await flushHubOutbox()
          return json({ ok: true, ...result, status: hubStatus() })
        }
        if (action !== 'connect') {
          return json({ ok: false, error: 'unknown-action' }, { status: 400 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: 'invalid-json' }, { status: 400 })
        }
        const parsed = ConnectSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { ok: false, error: 'invalid-request', detail: parsed.error.flatten() },
            { status: 400 },
          )
        }
        const result = await connectHub(parsed.data)
        if (!result.ok) {
          const status =
            result.error === 'hub-unreachable' || result.error === 'invalid-request'
              ? 400
              : 403
          return json({ ok: false, error: result.error }, { status })
        }
        return json({ ok: true, status: result.status }, { status: 201 })
      },
    },
  },
})
