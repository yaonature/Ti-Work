import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createSessionCookie,
  generateSessionToken,
  isPasswordProtectionEnabled,
  storeSessionToken,
  verifyPassword,
} from '../../server/auth-middleware'
import {
  authenticateUser,
  isMultiUserEnabled,
} from '../../server/identity'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
} from '../../server/rate-limit'
import { hubLoginGate } from '../../server/hub-client'

// 单用户模式：仅密码；多用户模式：用户名 + 密码
const SingleUserSchema = z.object({
  password: z.string().max(1000),
})

const MultiUserSchema = z.object({
  userId: z.string().min(1).max(200),
  password: z.string().max(1000),
})

export const Route = createFileRoute('/api/auth')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        // If password protection is disabled (single-user) and multi-user mode
        // is off, reject auth attempts entirely.
        const multiUser = isMultiUserEnabled()
        if (!multiUser && !isPasswordProtectionEnabled()) {
          return json(
            { ok: false, error: '当前无需认证' },
            { status: 400 },
          )
        }

        // 企业中枢门禁：已接入中枢且许可证超过硬期限 → 拒绝本地登录（有效期受中枢控制）
        const hubGate = hubLoginGate()
        if (!hubGate.ok) {
          return json(
            { ok: false, error: hubGate.reason },
            { status: 403 },
          )
        }

        // Rate limit: max 5 auth attempts per minute per IP
        const ip = getClientIp(request)
        if (!rateLimit(`auth:${ip}`, 5, 60_000)) {
          return rateLimitResponse()
        }

        try {
          const raw = await request.json().catch(() => ({}))

          // 多用户模式：身份表校验（bcrypt），签发绑定 userId 的会话
          if (multiUser) {
            const parsed = MultiUserSchema.safeParse(raw)
            if (!parsed.success) {
              return json(
                { ok: false, error: '无效的请求' },
                { status: 400 },
              )
            }
            const { userId, password } = parsed.data
            const user = await authenticateUser(userId, password)
            if (!user) {
              // Add small delay to prevent brute force
              await new Promise((resolve) => setTimeout(resolve, 1000))
              return json(
                { ok: false, error: '用户名或密码错误' },
                { status: 401 },
              )
            }
            const token = generateSessionToken()
            storeSessionToken(token, user.userId)
            return json(
              { ok: true, userId: user.userId, role: user.role },
              {
                status: 200,
                headers: {
                  'Set-Cookie': createSessionCookie(token),
                },
              },
            )
          }

          // 单用户模式：环境变量密码校验（原行为）
          const parsed = SingleUserSchema.safeParse(raw)
          if (!parsed.success) {
            return json(
              { ok: false, error: '无效的请求' },
              { status: 400 },
            )
          }

          const { password } = parsed.data

          // Verify password
          const valid = verifyPassword(password)

          if (!valid) {
            // Add small delay to prevent brute force
            await new Promise((resolve) => setTimeout(resolve, 1000))
            return json(
              { ok: false, error: '密码错误' },
              { status: 401 },
            )
          }

          // Generate session token
          const token = generateSessionToken()
          storeSessionToken(token)

          // Return success with Set-Cookie header
          return json(
            { ok: true },
            {
              status: 200,
              headers: {
                'Set-Cookie': createSessionCookie(token),
              },
            },
          )
        } catch (err) {
          if (import.meta.env.DEV) console.error('[/api/auth] Error:', err)
          return json(
            { ok: false, error: '认证失败' },
            { status: 500 },
          )
        }
      },
    },
  },
})
