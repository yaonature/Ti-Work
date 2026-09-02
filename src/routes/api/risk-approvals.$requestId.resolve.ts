/**
 * POST /api/risk-approvals/:requestId/resolve
 *
 * 本地风险动作确认/审批请求落定端点（终端执行中心确认面板调用）。
 *  - approved：接受范围 once | session | always；
 *      always 由 resolveRiskApproval 写回 security.risk_controls 配置；
 *  - denied：拒绝本次操作。
 * 每次落定经 recordAuthorizationDecision 沉淀统一策略事件流（审计）。
 * 请求不存在 / 已过期 / 已落定 → 404，前端凭据无效时重新发起终端操作。
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireLocalOrAuth } from '../../server/auth-middleware'
import { requireJsonContentType } from '../../server/rate-limit'
import {
  
  resolveRiskApproval
} from '../../server/risk-approval'
import type {RiskApprovalScope} from '../../server/risk-approval';

const VALID_SCOPES: ReadonlyArray<RiskApprovalScope> = [
  'once',
  'session',
  'always',
]

export const Route = createFileRoute('/api/risk-approvals/$requestId/resolve')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!requireLocalOrAuth(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        const body = (await request.json().catch(() => ({}))) as Record<
          string,
          unknown
        >
        const decision = body.decision === 'denied' ? 'denied' : 'approved'
        let scope: RiskApprovalScope | null = null
        if (
          decision === 'approved' &&
          typeof body.scope === 'string' &&
          VALID_SCOPES.includes(body.scope as RiskApprovalScope)
        ) {
          scope = body.scope as RiskApprovalScope
        }

        const resolved = resolveRiskApproval(params.requestId, decision, scope)
        if (!resolved) {
          return json(
            { ok: false, error: '审批请求无效、已过期或已处理。' },
            { status: 404 },
          )
        }

        return json({
          ok: true,
          status: resolved.status,
          scope: resolved.scope,
        })
      },
    },
  },
})
