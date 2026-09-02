/**
 * GET /api/habits
 *
 * 只读查询本地行为画像（常用目录 / 常用网站 / 风险动作倾向 / 纠偏记录）。
 * 数据来自 `desktop.policy_decision` 事件流在本地聚合的画像文件
 * （~/.hermes/habits/），默认私有，不涉及云端。
 *
 * 参数：
 *  - profile：画像归属档案名（缺省 default）
 *  - limit：每类画像最多返回条数（缺省 20，上限 100）
 */

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { getHabitProfile } from '../../server/habit-profile'

export const Route = createFileRoute('/api/habits')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        try {
          const url = new URL(request.url)
          const profileName = (url.searchParams.get('profile') || '').trim()
          const limit = Math.min(
            100,
            Math.max(1, Number(url.searchParams.get('limit') || '20')),
          )
          const profile = getHabitProfile({
            profileName: profileName || undefined,
            limit,
          })
          return json({ ok: true, profile })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
