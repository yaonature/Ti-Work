/**
 * 血缘 API（G3）
 *
 * POST /api/lineage?taskId=      → 写入一条血缘事件（幂等），201 { ok, event }
 * GET  /api/lineage?taskId=      → 血缘链查询 { ok, chain }
 *
 * 事件模型契约：task / run / owner / prev_task / ts / dept（见 lineage-store.ts）
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'
import {
  getUserIdFromRequest,
  requireAuth,
} from '../../server/auth-middleware'
import {
  getLineageChain,
  publishLineageEvent,
} from '../../server/lineage-store'
import { requireJsonContentType } from '../../server/rate-limit'

const EVENT_TYPES = [
  'task.created',
  'task.updated',
  'task.moved',
  'task.deleted',
  'run.started',
  'run.completed',
  'run.error',
] as const

const PublishEventSchema = z.object({
  eventId: z.string().trim().max(128).optional(),
  type: z.enum(EVENT_TYPES),
  taskId: z.string().trim().min(1).max(128),
  runId: z.string().trim().max(128).optional(),
  ownerId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._-]{1,64}$/)
    .optional(),
  prevTaskId: z.string().trim().max(128).nullable().optional(),
  dept: z.string().trim().max(64).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const Route = createFileRoute('/api/lineage')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        const url = new URL(request.url)
        const taskId = url.searchParams.get('taskId')?.trim()

        if (!taskId) {
          return json(
            { ok: false, error: '缺少 taskId 查询参数' },
            { status: 400 },
          )
        }
        const chain = await getLineageChain(taskId)
        if (!chain) {
          return json(
            { ok: false, error: '在血缘图中未找到该 taskId' },
            { status: 404 },
          )
        }
        return json({ ok: true, chain })
      },

      POST: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return json({ ok: false, error: '无效的 JSON' }, { status: 400 })
        }

        const parsed = PublishEventSchema.safeParse(body)
        if (!parsed.success) {
          return json(
            {
              ok: false,
              error: parsed.error.issues[0]?.message ?? '无效的输入',
            },
            { status: 400 },
          )
        }

        const currentUserId = getUserIdFromRequest(request)
        const result = await publishLineageEvent({
          eventId: parsed.data.eventId,
          type: parsed.data.type,
          taskId: parsed.data.taskId,
          runId: parsed.data.runId,
          ownerId: parsed.data.ownerId || currentUserId || 'anonymous',
          prevTaskId: parsed.data.prevTaskId ?? null,
          dept: parsed.data.dept ?? null,
          payload: parsed.data.payload,
        })

        if (!result.ok) {
          return json(
            { ok: false, error: 'Redis 不可用' },
            { status: 503 },
          )
        }
        if (result.duplicate) {
          // 幂等语义：重复 eventId 视为已处理成功
          return json({ ok: true, duplicate: true, event: null })
        }
        return json({ ok: true, duplicate: false, event: result.event }, { status: 201 })
      },
    },
  },
})
