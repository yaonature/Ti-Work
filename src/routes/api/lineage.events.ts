/**
 * GET /api/lineage/events — 血缘事件重放（审计/补数，仅 super_admin）
 *
 * 直读 Redis Stream（XRANGE），不经过消费组、不改变消费状态。
 * ?fromId=起始消息ID（缺省从头）&count=条数（默认100，上限1000）
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireRole } from '../../server/auth-middleware'
import { replayLineageEvents } from '../../server/lineage-store'

export const Route = createFileRoute('/api/lineage/events')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const url = new URL(request.url)
        const fromId = url.searchParams.get('fromId')?.trim() || '-'
        const count = Math.min(
          Math.max(Number(url.searchParams.get('count') ?? '100'), 1),
          1000,
        )
        const events = await replayLineageEvents(fromId, count)
        return json({ ok: true, events, fromId })
      },
    },
  },
})
