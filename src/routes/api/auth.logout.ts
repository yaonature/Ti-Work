import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getSessionTokenFromCookie,
  revokeSessionToken,
} from '../../server/auth-middleware'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = getSessionTokenFromCookie(request.headers.get('cookie'))
        if (token) revokeSessionToken(token)

        // 清除会话 cookie（Max-Age=0 使浏览器立即丢弃）
        const clearCookie =
          'hermes-auth=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': clearCookie,
          },
        })
      },
    },
  },
})
