/**
 * G6 飞书自建应用授权 API —— /api/integrations/feishu。
 *
 * GET    /api/integrations/feishu  读取授权状态（appId、appSecret 掩码、已连接）
 * POST   /api/integrations/feishu  用 app_id + app_secret 换取 tenant_access_token，
 *                                  校验成功后写入配置（~/.hermes/config.yaml `integrations.feishu` app_* 字段）
 * DELETE /api/integrations/feishu  移除授权（仅清空 app_* 字段，保留 webhook 配置）
 *
 * 与 webhook 通道配置共用 `integrations.feishu` 段；写入时由 setFeishuAppSettings 合并，
 * 不覆盖 webhook_url/secret/enabled 等字段。
 */
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth, requireRole } from '../../server/auth-middleware'
import { verifyFeishuAppToken } from '../../server/feishu-auth'
import {
  getConfigPath,
  getFeishuAppSettings,
  readConfigFile,
  setFeishuAppSettings,
  toFeishuAppState,
  writeConfigFile,
} from '../../server/integrations'

const CONFIG_PATH = getConfigPath()

export const Route = createFileRoute('/api/integrations/feishu')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard
        const config = readConfigFile(CONFIG_PATH)
        const state = toFeishuAppState(getFeishuAppSettings(config))
        return Response.json({ ok: true, state })
      },

      POST: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard
        const body = (await request.json()) as Record<string, unknown>
        const appId = String(body.appId ?? '').trim()
        const appSecret = String(body.appSecret ?? '').trim()
        if (!appId || !appSecret) {
          return Response.json(
            { ok: false, message: 'App ID 和 App Secret 均为必填' },
            { status: 400 },
          )
        }

        const verification = await verifyFeishuAppToken({ appId, appSecret })
        if (!verification.ok) {
          return Response.json({
            ok: false,
            message: verification.message,
            code: verification.code,
          })
        }

        const config = readConfigFile(CONFIG_PATH)
        const updated = setFeishuAppSettings(config, {
          appId,
          appSecret,
          appToken: verification.tenantAccessToken ?? '',
          appVerified: true,
        })
        writeConfigFile(CONFIG_PATH, updated)

        const state = toFeishuAppState(getFeishuAppSettings(updated))
        return Response.json({
          ok: true,
          message: '连接成功，凭据已保存。',
          state,
          tokenExpire: verification.expire,
        })
      },

      DELETE: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard
        const config = readConfigFile(CONFIG_PATH)
        const updated = setFeishuAppSettings(config, null)
        writeConfigFile(CONFIG_PATH, updated)
        const state = toFeishuAppState(getFeishuAppSettings(updated))
        return Response.json({ ok: true, state })
      },
    },
  },
})
