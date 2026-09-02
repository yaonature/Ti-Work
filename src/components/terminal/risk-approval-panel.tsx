/**
 * RiskApprovalPanel — 执行中心高风险动作确认/审批面板。
 *
 * 终端等高危动作被 Authorization Guard 拦截（needs_confirmation /
 * needs_approval）时，由 terminal-workspace 弹出本面板，展示动作详情并
 * 提供四个决策入口：仅本次允许 / 本次会话允许 / 始终允许 / 拒绝。
 *
 * - 仅本次允许：凭据仅用于当前这次重试；
 * - 本次会话允许：凭据在本浏览器会话内持续生效（sessionStorage）；
 * - 始终允许：服务端写回 security.risk_controls，移除该动作确认/审批要求；
 * - 拒绝：终止本次操作，面板关闭。
 */
import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { LockIcon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export interface RiskApprovalPayload {
  code: 'terminal_requires_confirmation' | 'terminal_requires_approval'
  requestId: string
  action: string
  subject: string
  decision: 'needs_confirmation' | 'needs_approval'
}

export type RiskApprovalResolve =
  | 'once'
  | 'session'
  | 'always'
  | 'denied'

interface RiskApprovalPanelProps {
  request: RiskApprovalPayload
  onResolve: (resolve: RiskApprovalResolve) => void
  onDismiss: () => void
}

export function RiskApprovalPanel({
  request,
  onResolve,
  onDismiss,
}: RiskApprovalPanelProps) {
  const [resolved, setResolved] = useState<RiskApprovalResolve | null>(null)
  const [expanded, setExpanded] = useState(false)

  const isApproval = request.decision === 'needs_approval'
  const title = isApproval ? '该操作需要审批' : '该操作需要您确认'

  // ── 已响应收据 ─────────────────────────────────────────────────────
  if (resolved) {
    const approved =
      resolved === 'once' || resolved === 'session' || resolved === 'always'
    return (
      <div
        data-testid="terminal_risk_approval_panel"
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
          approved
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
            : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        )}
      >
        <span className="font-medium">
          {approved ? '已允许' : '已拒绝'}：
        </span>
        <span className="truncate font-mono">{request.subject}</span>
      </div>
    )
  }

  return (
    <div
      data-testid="terminal_risk_approval_panel"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm dark:border-amber-800/50 dark:bg-amber-900/15"
    >
      {/* 头部：标题 + 动作详情 */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <HugeiconsIcon
              icon={LockIcon}
              size={14}
              className="shrink-0"
            />
            {title}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-amber-600 dark:text-amber-500">
            {request.subject}
          </p>
          {expanded && (
            <pre className="mt-2 max-h-32 overflow-auto rounded bg-amber-100/60 p-2 text-[10px] leading-relaxed text-amber-700 whitespace-pre-wrap break-all dark:bg-amber-900/30 dark:text-amber-400">
              {`动作: ${request.action}\n范围: ${request.requestId}`}
            </pre>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="shrink-0 text-[10px] text-amber-500 underline hover:text-amber-700 dark:text-amber-600 dark:hover:text-amber-400"
        >
          {expanded ? '收起' : '详情'}
        </button>
      </div>

      {/* 决策按钮 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="risk_approval_allow_once"
          onClick={() => {
            setResolved('once')
            onResolve('once')
          }}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 active:bg-emerald-700"
        >
          仅本次允许
        </button>
        <button
          type="button"
          data-testid="risk_approval_allow_session"
          onClick={() => {
            setResolved('session')
            onResolve('session')
          }}
          className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800"
        >
          本次会话允许
        </button>
        <button
          type="button"
          data-testid="risk_approval_allow_always"
          onClick={() => {
            setResolved('always')
            onResolve('always')
          }}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 active:bg-blue-700"
        >
          始终允许
        </button>
        <button
          type="button"
          data-testid="risk_approval_deny"
          onClick={() => {
            setResolved('denied')
            onResolve('denied')
          }}
          className="rounded-lg border border-red-200 bg-surface px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-100 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          拒绝
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 underline hover:text-amber-800 dark:text-amber-500 dark:hover:text-amber-300"
        >
          稍后处理
        </button>
      </div>
    </div>
  )
}
