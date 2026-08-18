import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../server/auth-middleware'
import {
  getValidatedBootstrapState,
  triggerBootstrap,
} from '../../server/hermes-bootstrap'

export const Route = createFileRoute('/api/engine-bootstrap')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        // 方案 A：后台触发安装，立即返回当前进度（不阻塞等待安装完成）
        triggerBootstrap()
        const state = await getValidatedBootstrapState()
        return json(
          {
            ok: state.phase === 'ready',
            phase: state.phase,
            message: state.message,
            error: state.error,
            failureCategory: state.failureCategory,
            preparedBy: state.preparedBy,
            stageIndex: state.stageIndex,
            stageCount: state.stages.length,
            currentStage: state.stages[state.stageIndex]?.title ?? null,
            attempt: state.attempt,
          },
          { status: 200 },
        )
      },
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        triggerBootstrap()
        const state = await getValidatedBootstrapState()
        return json(
          {
            ok: state.phase === 'ready',
            phase: state.phase,
            message: state.message,
            error: state.error,
            failureCategory: state.failureCategory,
            preparedBy: state.preparedBy,
            stageIndex: state.stageIndex,
            stageCount: state.stages.length,
            currentStage: state.stages[state.stageIndex]?.title ?? null,
            attempt: state.attempt,
          },
          { status: 200 },
        )
      },
    },
  },
})
