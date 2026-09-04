import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../../server/auth-middleware'
import { gatewayFetch } from '../../../server/agent-hub-client'

const RELOAD_PATHS = ['/api/reload-mcp', '/api/mcp/reload']

export const Route = createFileRoute('/api/mcp/reload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        for (const path of RELOAD_PATHS) {
          try {
            const response = await gatewayFetch(path, { method: 'POST' })

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
