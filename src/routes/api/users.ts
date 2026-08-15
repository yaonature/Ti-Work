/**
 * GET/POST /api/users — 用户管理（仅 super_admin）
 *
 * GET   → { ok: true, users: IdentityUser[] }  脱敏列表
 * POST  → 管理员创建账号（可指定角色），201 { ok: true, user }
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import { requireRole } from '../../server/auth-middleware'
import { createUser, listUsers } from '../../server/identity'
import { requireJsonContentType } from '../../server/rate-limit'

const CreateUserSchema = z.object({
  userId: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._-]{3,32}$/,
      'userId must be 3-32 chars of letters, digits, dot, dash or underscore',
    ),
  password: z.string().min(8, 'password must be at least 8 characters'),
  displayName: z.string().trim().max(64).optional(),
  role: z.enum(['super_admin', 'regular_admin']).optional(),
})

export const Route = createFileRoute('/api/users')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard
        return json({ ok: true, users: listUsers() })
      },

      POST: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: '无效的 JSON' }, { status: 400 })
        }

        const parsed = CreateUserSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues[0]?.message ?? '无效的输入' },
            { status: 400 },
          )
        }

        try {
          const user = await createUser({
            userId: parsed.data.userId,
            password: parsed.data.password,
            displayName: parsed.data.displayName,
            role: parsed.data.role ?? 'regular_admin',
          })
          return json({ ok: true, user }, { status: 201 })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Create failed'
          const duplicate = /already exists/i.test(message)
          return json({ ok: false, error: message }, { status: duplicate ? 409 : 500 })
        }
      },
    },
  },
})
