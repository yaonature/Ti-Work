/**
 * PATCH/DELETE /api/users/$id — 用户维护
 *
 * PATCH：修改 displayName / password / role。
 *   - 改 role 必须 super_admin（管理员分配页）
 *   - 改他人信息必须 super_admin；仅允许修改自己的 displayName/password
 * DELETE：仅 super_admin；不能删除自己（防锁死）；不能删除最后一个 super_admin
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getUserIdFromRequest,
  requireAuth,
  requireRole,
} from '../../server/auth-middleware'
import {
  deleteUser,
  getUser,
  listUsers,
  sanitizeUser,
  updateUserDisplayName,
  updateUserPassword,
  updateUserRole,
} from '../../server/identity'
import { requireJsonContentType } from '../../server/rate-limit'

const PatchSchema = z.object({
  displayName: z.string().trim().max(64).optional(),
  password: z.string().min(8, 'password must be at least 8 characters').optional(),
  role: z.enum(['super_admin', 'regular_admin']).optional(),
})

export const Route = createFileRoute('/api/users/$id')({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        const targetId = params.id
        const selfId = getUserIdFromRequest(request)
        const isSelf = selfId === targetId

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: '无效的 JSON' }, { status: 400 })
        }

        const parsed = PatchSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            { ok: false, error: parsed.error.issues[0]?.message ?? '无效的输入' },
            { status: 400 },
          )
        }
        if (Object.keys(parsed.data).length === 0) {
          return json({ ok: false, error: '没有需要更新的内容' }, { status: 400 })
        }

        const target = getUser(targetId)
        if (!target) {
          return json({ ok: false, error: '未找到该用户' }, { status: 404 })
        }

        // 角色调整属于管理操作：仅 super_admin 可改；且不能给自己降权（防锁死）
        if (parsed.data.role !== undefined) {
          const roleGuard = requireRole(request, 'admin')
          if (roleGuard) return roleGuard
          if (isSelf && parsed.data.role !== 'super_admin') {
            return json(
              { ok: false, error: '不能降级自己的账号' },
              { status: 400 },
            )
          }
          updateUserRole(targetId, parsed.data.role)
        }

        // 他人信息修改（displayName/password）仅 super_admin
        if (!isSelf && (parsed.data.displayName !== undefined || parsed.data.password !== undefined)) {
          const roleGuard = requireRole(request, 'admin')
          if (roleGuard) return roleGuard
        }

        if (parsed.data.displayName !== undefined) {
          updateUserDisplayName(targetId, parsed.data.displayName)
        }
        if (parsed.data.password !== undefined) {
          await updateUserPassword(targetId, parsed.data.password)
        }

        return json({
          ok: true,
          user: sanitizeUser(getUser(targetId)!),
        })
      },

      DELETE: async ({ request, params }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const targetId = params.id
        const selfId = getUserIdFromRequest(request)
        if (selfId === targetId) {
          return json(
            { ok: false, error: '不能删除自己的账号' },
            { status: 400 },
          )
        }

        const target = getUser(targetId)
        if (!target) {
          return json({ ok: false, error: '未找到该用户' }, { status: 404 })
        }

        // 保护最后一个 super_admin，避免账号体系锁死
        if (target.role === 'super_admin') {
          const superAdmins = listUsers().filter(
            (u) => u.role === 'super_admin',
          )
          if (superAdmins.length <= 1) {
            return json(
              { ok: false, error: '不能删除最后一个超级管理员' },
              { status: 400 },
            )
          }
        }

        await deleteUser(targetId)
        return json({ ok: true })
      },
    },
  },
})
