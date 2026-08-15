import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../../server/auth-middleware'
import { getHermesApiToken, HERMES_API } from '../../../server/gateway-capabilities'

function authHeaders(): Record<string, string> {
  const token = getHermesApiToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const RELOAD_PATHS = ['/api/reload-mcp', '/api/mcp/reload']

export const Route = createFileRoute('/api/mcp/reload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        for (const path of RELOAD_PATHS) {
          try {
            const response = await fetch(`${HERMES_API}${path}`, {
              method: 'POST',
              headers: authHeaders(),
            })

            if (response.ok) {
              return Response.json({
                ok: true,
                message: '已请求重载 MCP 服务器。',
              })
            }
          } catch {
            // Try the next candidate endpoint.
          }
        }

        return Response.json({
          ok: false,
          message: '请在聊天中使用 /reload-mcp 重载 MCP 服务器。',
        })
      },
    },
  },
})
