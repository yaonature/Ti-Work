import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createUser,
  isMultiUserEnabled,
  isSelfRegisterEnabled,
} from '../../server/identity'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
} from '../../server/rate-limit'

// 企业安全默认：注册关闭。管理员在用户管理页创建账号；仅显式开启
// TI_WORK_SELF_REGISTER=1 后允许自助注册（注册即最低权限 regular_admin）。
const RegisterSchema = z.object({
  userId: z
    .string()
    .trim()
    .regex(
      /^[a-zA-Z0-9._-]{3,32}$/,
      'userId must be 3-32 chars of letters, digits, dot, dash or underscore',
    ),
  password: z.string().min(8, 'password must be at least 8 characters'),
  displayName: z.string().trim().max(64).optional(),
})

export const Route = createFileRoute('/api/auth/register')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isMultiUserEnabled()) {
          return json(
            { ok: false, error: '未启用多用户模式' },
            { status: 403 },
          )
        }
        if (!isSelfRegisterEnabled()) {
          return json(
            { ok: false, error: '未开放自助注册' },
            { status: 403 },
          )
        }

        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        const ip = getClientIp(request)
        if (!rateLimit(`register:${ip}`, 5, 60_000)) {
          return rateLimitResponse()
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: '无效的 JSON' }, { status: 400 })
        }

        const parsed = RegisterSchema.safeParse(body)
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
            role: 'regular_admin',
          })
          return json({ ok: true, user }, { status: 201 })
        } catch (err) {
          // createUser 对重名抛 "User already exists"
          const message = err instanceof Error ? err.message : 'Registration failed'
          const duplicate = /already exists/i.test(message)
          return json({ ok: false, error: message }, { status: duplicate ? 409 : 500 })
        }
      },
    },
  },
})
