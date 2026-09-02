/**
 * GET /api/high-frequency-tasks
 *
 * 只读查询本地高频任务画像（P1-B 行为资产沉淀 — 任务画像层）。
 * 服务端在序列层做跨会话结构相似度聚类，产出「任务意图 + 步骤模板 +
 * 参数样例 + 频次/周期」画像，供工作台「高频任务」露出与后续一键重放。
 *
 * 数据来自本地序列沉淀（~/.hermes/habit-sequences/），默认私有，不涉及云端；
 * 识别结果纯只读，不触碰计数画像与授权策略。
 *
 * 参数：
 *  - profile：画像归属档案名（缺省 default）
 *  - limit：最多返回任务数（缺省 20，上限 50）
 *  - windowDays：观察窗口天数（缺省 30，产品默认；识别只统计最近该区间）
 */

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import { getHighFrequencyTasks } from '../../server/high-frequency-tasks'

export const Route = createFileRoute('/api/high-frequency-tasks')({
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
            50,
            Math.max(1, Number(url.searchParams.get('limit') || '20')),
          )
          const rawWindowDays = url.searchParams.get('windowDays')
          const windowDays = rawWindowDays
            ? Math.min(365, Math.max(1, Number(rawWindowDays)))
            : undefined

          const tasks = getHighFrequencyTasks({
            profileName: profileName || undefined,
            limit,
            windowMs:
              windowDays === undefined
                ? undefined
                : windowDays * 24 * 60 * 60 * 1000,
          })
          return json({
            ok: true,
            computedAt: Date.now(),
            profileName: profileName || 'default',
            windowDays: windowDays ?? 30,
            tasks,
          })
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
