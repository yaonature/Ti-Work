import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { requireAuth } from '../../server/auth-middleware'

const BodySchema = z.object({
  provider: z.string(),
})

export const Route = createFileRoute('/api/oauth/device-code')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ error: '无效的 JSON' }, { status: 400 })
        }

        const parsed = BodySchema.safeParse(body)
        if (!parsed.success) {
          return json({ error: '缺少 provider 参数' }, { status: 400 })
        }

        const { provider } = parsed.data

        if (provider === 'nous') {
          try {
            const res = await fetch(
              'https://portal.nousresearch.com/api/oauth/device/code',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 'client_id=hermes-cli',
              },
            )
            const data = await res.json()
            if (!res.ok) {
              return json(
                { error: data.error || '设备码请求失败' },
                { status: res.status },
              )
            }
            return json(data)
          } catch (err) {
            return json(
              { error: err instanceof Error ? err.message : 'Network error' },
              { status: 500 },
            )
          }
        }

        return json(
          {
            error: `该 provider 不支持 OAuth 设备流：${provider}`,
          },
          { status: 400 },
        )
      },
    },
  },
})
