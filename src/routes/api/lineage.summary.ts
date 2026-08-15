/**
 * GET /api/lineage/summary — 血缘聚合摘要（管理驾驶舱数据源，仅 super_admin）
 *
 * 跨用户/跨部门聚合 G3 血缘事件（任务流转、列分布、部门报表、甘特图数据）。
 * Redis 不可用时返回空摘要（{ ok:true, summary:空 }），页面优雅降级为空态。
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireRole } from '../../server/auth-middleware'
import { getLineageSummary } from '../../server/lineage-analytics'

export const Route = createFileRoute('/api/lineage/summary')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const summary = await getLineageSummary()
        return json({ ok: true, summary })
      },
    },
  },
})
