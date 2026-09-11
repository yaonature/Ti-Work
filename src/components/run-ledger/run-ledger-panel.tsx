/**
 * 执行账本面板（Run Ledger Panel）—— 会话页右区「执行账本」首期 UI。
 *
 * 状态机（对应蓝图 D1 / 空态决策）：
 * - 无任何记录：不渲染（0 宽，不占栅格）。
 * - Run 进行中：自动展开；任务头显示状态 + 业务标题；进度节点自滚。
 * - 完成后空闲超时（默认 60s）收敛为细窄角标；角标点击可回看最近一次。
 * - 新 Run 开启（startedAt 变化）自动重新展开，并解除手动固定。
 *
 * 数据源：全部来自 run-ledger-store 的前端运行视图模型（同一 sessionKey 最近一次
 * Run），审批区复用对话流同款 ApprovalCard + 同源回调（双位同源，不新增状态）。
 */
import { useEffect, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Clock01Icon,
  EyeIcon,
} from '@hugeicons/core-free-icons'
import { useRunLedgerStore } from './run-ledger-store'
import type { ApprovalRequest } from '@/lib/approvals-store'
import type { LedgerNode, LedgerRun } from './run-ledger-store'
import { cn } from '@/lib/utils'
import { ApprovalCard } from '@/screens/chat/components/approval-card'
import FilePreviewDialog from '@/components/file-explorer/file-preview-dialog'

/** 完成后空闲收敛为角标的时长（蓝图建议 60s，先以常量收敛，暂不做设置入口） */
const IDLE_COLLAPSE_MS = 60_000
/** 展开态面板宽度 */
const EXPANDED_WIDTH = 320
/** 收敛角标宽度 */
const PILL_WIDTH = 30

// ── Props ──────────────────────────────────────────────────────────────────────

interface RunLedgerPanelProps {
  /** 当前会话 key（与发送消息开 Run 使用同一取值，保证账本收账对齐） */
  sessionKey: string
  /** 对话流内联审批的同一状态源（同源不同位） */
  approvals: Array<ApprovalRequest>
  onResolveApproval: (
    approval: ApprovalRequest,
    status: 'approved' | 'denied' | 'always-allowed',
    scope?: 'once' | 'session' | 'always',
  ) => void
}

type ResolveApproval = RunLedgerPanelProps['onResolveApproval']

// ── 状态图标 ────────────────────────────────────────────────────────────────────

/** 头部状态点：active 呼吸 / complete 落定 / error 危险 */
function HeaderStatusDot({ run }: { run: LedgerRun }) {
  if (run.status === 'error') {
    return (
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: 'var(--theme-danger)' }}
      />
    )
  }
  if (run.status === 'complete') {
    return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
  }
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ background: 'var(--theme-accent)' }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{ background: 'var(--theme-accent)' }}
      />
    </span>
  )
}

/** 节点状态图标：运行中呼吸环 / 成功勾 / 失败警示 / 中断（失败 Run 中未收口的节点） */
function NodeStatusMark({
  node,
  interrupted,
}: {
  node: LedgerNode
  interrupted: boolean
}) {
  if (interrupted) {
    return (
      <span className="text-[10px]" style={{ color: 'var(--theme-muted)' }}>
        –
      </span>
    )
  }
  if (node.status === 'success') {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        size={14}
        className="text-emerald-500"
      />
    )
  }
  if (node.status === 'error') {
    return (
      <span style={{ color: 'var(--theme-danger)' }}>
        <HugeiconsIcon icon={Alert02Icon} size={14} />
      </span>
    )
  }
  return (
    <span
      className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-t-transparent"
      style={{
        borderColor: 'var(--theme-accent)',
        borderTopColor: 'transparent',
      }}
    />
  )
}

// ── 主体呈现 ────────────────────────────────────────────────────────────────────

/** 文件类动作展示为《文件名》，检索/链接类直接展示主体文本 */
function formatSubject(node: LedgerNode): string {
  if (node.kind === 'read' || node.kind === 'write' || node.kind === 'edit') {
    return `《${node.subject ?? ''}》`
  }
  return node.subject ?? ''
}

// ── 节点行 ──────────────────────────────────────────────────────────────────────

function NodeRow({
  node,
  run,
  open,
  onToggle,
  onPreview,
}: {
  node: LedgerNode
  run: LedgerRun
  open: boolean
  onToggle: () => void
  onPreview: (path: string) => void
}) {
  // 失败 Run 中尚未收口的节点以「中断」语义呈现，避免永远旋转的假象
  const interrupted = run.status === 'error' && node.status === 'running'
  const subjectText = formatSubject(node)
  const timeText = new Date(node.ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return (
    <li>
      <div className="group flex items-center gap-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-2 py-1.5 text-left"
        >
          <span className="mt-0.5 flex w-4 shrink-0 items-center justify-center">
            <NodeStatusMark node={node} interrupted={interrupted} />
          </span>
          <span className="min-w-0 flex-1 text-xs leading-5">
            <span
              className={cn(
                'truncate font-medium',
                interrupted && 'line-through opacity-70',
              )}
              style={{ color: 'var(--theme-text)' }}
            >
              {node.label}
            </span>
            {subjectText && (
              <span className="ml-1 truncate" style={{ color: 'var(--theme-muted)' }}>
                · {subjectText}
              </span>
            )}
          </span>
        </button>
        {/* 产物直通：文件类动作保留完整路径时提供「预览」入口 */}
        {typeof node.filePath === 'string' && node.filePath && (
          <button
            type="button"
            onClick={() => onPreview(node.filePath as string)}
            title={`打开预览：${node.filePath}`}
            aria-label={`打开预览：${node.filePath}`}
            className="mr-0.5 shrink-0 rounded-md p-1.5 text-[var(--theme-muted)] opacity-0 transition-opacity hover:bg-black/10 hover:text-[var(--theme-accent)] group-hover:opacity-100"
          >
            <HugeiconsIcon icon={EyeIcon} size={14} />
          </button>
        )}
      </div>
      {open && (
        <div
          className="mx-1 mb-1 rounded-md px-2 py-1.5 text-[10px] leading-relaxed"
          style={{
            background: 'var(--theme-card2)',
            color: 'var(--theme-muted)',
          }}
        >
          <p className="truncate font-mono">
            {timeText} · {node.toolName}
          </p>
          {typeof node.filePath === 'string' && node.filePath && (
            <p className="mt-1 truncate font-mono">{node.filePath}</p>
          )}
          {node.summary && (
            <p className="mt-1 whitespace-pre-wrap break-all">{node.summary}</p>
          )}
        </div>
      )}
    </li>
  )
}

// ── 展开视图 ────────────────────────────────────────────────────────────────────

function ExpandedView({
  run,
  approvals,
  onResolveApproval,
  onCollapse,
  onPreview,
}: {
  run: LedgerRun
  approvals: Array<ApprovalRequest>
  onResolveApproval: ResolveApproval
  onCollapse: () => void
  onPreview: (path: string) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [detailKey, setDetailKey] = useState<string | null>(null)

  // 进行中的 Run 节点自动滚动到底部
  useEffect(() => {
    if (run.status !== 'active') return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [run.status, run.nodes.length])

  const pendingApprovals = approvals.filter((a) => a.status === 'pending')
  const statusText =
    run.status === 'active'
      ? '执行中'
      : run.status === 'complete'
        ? '已完成'
        : '执行失败'
  const statusColor =
    run.status === 'error'
      ? 'var(--theme-danger)'
      : run.status === 'complete'
        ? 'var(--theme-success, #10b981)'
        : 'var(--theme-accent)'

  return (
    <div className="flex h-full flex-col" style={{ width: EXPANDED_WIDTH }}>
      {/* 任务头 */}
      <header className="shrink-0 px-3 pb-2 pt-3">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--theme-muted)' }}
          >
            执行账本
          </span>
          <button
            type="button"
            onClick={onCollapse}
            title="收起账本"
            aria-label="收起账本"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              'hover:bg-black/5 dark:hover:bg-white/10',
            )}
            style={{ color: 'var(--theme-muted)' }}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <HeaderStatusDot run={run} />
          <span
            className="text-xs font-semibold"
            style={{ color: statusColor }}
          >
            {statusText}
          </span>
        </div>
        <p
          className="mt-1 line-clamp-2 text-sm leading-snug"
          style={{ color: 'var(--theme-text)' }}
        >
          {run.title}
        </p>
        {run.status === 'error' && run.errorMessage && (
          <p
            className="mt-1 line-clamp-2 text-[10px] leading-relaxed"
            style={{ color: 'var(--theme-danger)' }}
          >
            {run.errorMessage}
          </p>
        )}
      </header>

      {/* 待确认区（仅执行中，双位同源复用对话流同款审批卡） */}
      {run.status === 'active' && pendingApprovals.length > 0 && (
        <section
          className="mx-2 mb-1 space-y-2 rounded-lg p-2"
          style={{ background: 'var(--theme-card2)' }}
        >
          <p
            className="text-[10px] font-medium"
            style={{ color: 'var(--theme-accent)' }}
          >
            需要你确认
          </p>
          {pendingApprovals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onResolve={onResolveApproval}
            />
          ))}
        </section>
      )}

      {/* 进度节点（默认业务进度 + 可展开动作明细） */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-3 pt-1"
      >
        {run.nodes.length === 0 ? (
          <p
            className="px-2 pt-8 text-center text-xs"
            style={{ color: 'var(--theme-muted)' }}
          >
            {run.status === 'active' ? '智能体正在准备…' : '本次没有产生执行动作'}
          </p>
        ) : (
          <ol className="space-y-0.5">
            {run.nodes.map((node) => (
              <NodeRow
                key={node.key}
                node={node}
                run={run}
                open={detailKey === node.key}
                onToggle={() =>
                  setDetailKey((current) =>
                    current === node.key ? null : node.key,
                  )
                }
                onPreview={onPreview}
              />
            ))}
          </ol>
        )}
        {run.status === 'error' && (
          <p
            className="px-2 pb-1 pt-3 text-[10px] leading-relaxed"
            style={{ color: 'var(--theme-muted)' }}
          >
            执行已中断。可让智能体换一种方式继续处理（在下一条消息中说明你的要求即可）。
          </p>
        )}
      </div>
    </div>
  )
}

// ── 角标（收敛态）────────────────────────────────────────────────────────────────

function PillView({ run, onExpand }: { run: LedgerRun; onExpand: () => void }) {
  const isActive = run.status === 'active'
  const tip =
    run.status === 'active'
      ? `执行中：${run.title}`
      : run.status === 'complete'
        ? `已完成：${run.title}（点击回看）`
        : `执行失败：${run.title}（点击回看）`
  return (
    <button
      type="button"
      onClick={onExpand}
      title={tip}
      aria-label={tip}
      className={cn(
        'flex h-full w-full flex-col items-center pt-2.5',
        'hover:bg-black/5 dark:hover:bg-white/5',
      )}
    >
      {run.status === 'complete' && (
        <HugeiconsIcon
          icon={CheckmarkCircle01Icon}
          size={14}
          className="text-emerald-500"
        />
      )}
      {run.status === 'error' && (
        <span style={{ color: 'var(--theme-danger)' }}>
          <HugeiconsIcon icon={Alert02Icon} size={14} />
        </span>
      )}
      {isActive && (
        <span className="relative flex h-2 w-2">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: 'var(--theme-accent)' }}
          />
          <span
            className="relative inline-flex h-2 w-2 rounded-full"
            style={{ background: 'var(--theme-accent)' }}
          />
        </span>
      )}
      <span
        className="mt-3 flex flex-col items-center gap-1.5"
        style={{ color: 'var(--theme-muted)' }}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={12} />
        <span className="h-8 w-px" style={{ background: 'var(--theme-border)' }} />
      </span>
    </button>
  )
}

// ── 面板主组件 ──────────────────────────────────────────────────────────────────

export function RunLedgerPanel({
  sessionKey,
  approvals,
  onResolveApproval,
}: RunLedgerPanelProps) {
  const run = useRunLedgerStore((s) => (sessionKey ? s.runs[sessionKey] : undefined))
  // 新 Run（startedAt 变化）自动展开；初次挂载仅「进行中」展开，完成态收敛为角标
  const [expanded, setExpanded] = useState(() => run?.status === 'active')
  const [pinned, setPinned] = useState(false)
  // 产物直通：当前待预览的文件路径（账本内打开，复用 FilePreviewDialog 契约）
  const [previewPath, setPreviewPath] = useState<string | null>(null)

  // 新 Run 开启：自动展开、解除手动固定（仅以 Run 身份 startedAt 为依赖，不随节点变化反复重置）
  useEffect(() => {
    if (!run) return
    setExpanded(run.status === 'active')
    setPinned(false)
  }, [run?.startedAt])

  // 终态空闲超时收敛为角标（手动固定查看时跳过自动收敛）
  useEffect(() => {
    if (!run || run.status === 'active' || pinned || !expanded) return
    const timer = window.setTimeout(() => setExpanded(false), IDLE_COLLAPSE_MS)
    return () => window.clearTimeout(timer)
  }, [run, pinned, expanded])

  if (!run) return null

  const openPreview = (path: string) => setPreviewPath(path)

  return (
    <>
      <aside
        className="relative h-full shrink-0 overflow-hidden border-l transition-[width] duration-300 ease-out"
        style={{
          width: expanded ? EXPANDED_WIDTH : PILL_WIDTH,
          background: 'var(--theme-card)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {expanded ? (
          <ExpandedView
            run={run}
            approvals={approvals}
            onResolveApproval={onResolveApproval}
            onPreview={openPreview}
            onCollapse={() => {
              setExpanded(false)
              setPinned(false)
            }}
          />
        ) : (
          <PillView
            run={run}
            onExpand={() => {
              setExpanded(true)
              // 手动回看后保持展开（不自动收敛），直至新 Run 或再次收起
              setPinned(true)
            }}
          />
        )}
      </aside>

      {/* 产物卡直通：账本内打开文件预览（全局 dialog 自渲染 portal，无需改变布局） */}
      <FilePreviewDialog
        path={previewPath}
        onClose={() => setPreviewPath(null)}
        onSaved={() => {
          // 预览对话框内保存成功：账本无可刷列表，保持对话框打开便于继续查看
        }}
      />
    </>
  )
}
