'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { BarChartIcon, CoinsIcon, Delete01Icon } from '@hugeicons/core-free-icons'
import type { CrewUsage } from '@/lib/cost-api'
import type { CrewMember } from '@/lib/crews-api'
import { fetchCrewUsage, resetUsage } from '@/lib/cost-api'
import { AGENT_PERSONAS } from '@/lib/agent-personas'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface CostPanelProps {
  crewId: string
  members: Array<CrewMember>
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0.00'
  if (usd < 0.0001) return '< $0.0001'
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(4)}`
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--theme-muted)]">
          {label}
        </span>
      </div>
      <span
        className="text-xl font-bold tabular-nums"
        style={{ color: accent ?? 'var(--theme-text)' }}
      >
        {value}
      </span>
    </div>
  )
}

function UsageTable({
  usage,
  members,
}: {
  usage: CrewUsage
  members: Array<CrewMember>
}) {
  const memberMap = Object.fromEntries(members.map((m) => [m.sessionKey, m]))
  const rows = Object.values(usage.members).sort(
    (a, b) => b.lastUpdatedAt - a.lastUpdatedAt,
  )
  const hasZeroRows = rows.some(
    (r) => r.inputTokens === 0 && r.outputTokens === 0,
  )

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] overflow-hidden">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-[var(--theme-border)] px-4 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
          智能体
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">
          模型
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">
          输入
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">
          输出
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)] text-right">
          预估成本
        </span>
      </div>

      {/* Rows */}
      {rows.map((row) => {
        const member = memberMap[row.sessionKey]
        const persona = AGENT_PERSONAS.find(
          (p) => p.name.toLowerCase() === member?.model?.toLowerCase() ||
                 member?.displayName.toLowerCase().includes(p.name.toLowerCase()),
        )
        const noData = row.inputTokens === 0 && row.outputTokens === 0
        const modelLabel = row.model
          ? row.model.length > 18
            ? row.model.slice(0, 16) + '…'
            : row.model
          : null

        return (
          <div
            key={row.sessionKey}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-4 border-b border-[var(--theme-border)] px-4 py-2.5 last:border-b-0 hover:bg-[var(--theme-hover)]"
          >
            <span
              className={cn(
                'text-xs font-medium',
                member?.color ?? 'text-[var(--theme-text)]',
              )}
            >
              {row.displayName}
            </span>
            <span className="text-right">
              {modelLabel ? (
                <span className="rounded-full border border-[var(--theme-border)] px-1.5 py-px text-[10px] text-[var(--theme-muted)]">
                  {modelLabel}
                </span>
              ) : (
                <span className="text-xs text-[var(--theme-muted)]">—</span>
              )}
            </span>
            <span className="text-right text-xs tabular-nums text-[var(--theme-text)]">
              {noData ? '—' : formatTokens(row.inputTokens)}
            </span>
            <span className="text-right text-xs tabular-nums text-[var(--theme-text)]">
              {noData ? '—' : formatTokens(row.outputTokens)}
            </span>
            <span className="text-right text-xs tabular-nums text-[var(--theme-text)]">
              {noData ? '—' : formatCost(row.estimatedCostUsd)}
            </span>
          </div>
        )
      })}

      {hasZeroRows && (
        <div className="px-4 py-2 text-[10px] text-[var(--theme-muted)]">
          这些记录需要 Hermes 增强模式——便携模式下无法获取 Token 数据。
        </div>
      )}
    </div>
  )
}

export function CostPanel({ crewId, members }: CostPanelProps) {
  const queryClient = useQueryClient()

  const usageQuery = useQuery({
    queryKey: ['crew-usage', crewId],
    queryFn: () => fetchCrewUsage(crewId),
    refetchInterval: 30_000,
  })

  const resetMutation = useMutation({
    mutationFn: () => resetUsage(crewId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crew-usage', crewId] })
      toast('用量数据已清空')
    },
    onError: () => toast('清空用量失败', { type: 'error' }),
  })

  const usage = usageQuery.data

  if (usageQuery.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[var(--theme-muted)]">
        加载用量中…
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)]">
          <HugeiconsIcon
            icon={BarChartIcon}
            size={22}
            className="text-[var(--theme-muted)]"
          />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--theme-text)]">
            暂无用量数据
          </p>
          <p className="mt-1 max-w-xs text-xs text-[var(--theme-muted)]">
            每次智能体运行后记录 Token 用量。需要 Hermes 增强模式。
          </p>
        </div>
      </div>
    )
  }

  const totalTokens = usage.totalInputTokens + usage.totalOutputTokens

  return (
    <div className="h-full overflow-y-auto space-y-5 p-6">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="总 Token"
          value={formatTokens(totalTokens)}
          icon={
            <HugeiconsIcon
              icon={BarChartIcon}
              size={12}
              strokeWidth={1.8}
              className="text-[var(--theme-muted)]"
            />
          }
        />
        <KpiCard
          label="输入 / 输出"
          value={`${formatTokens(usage.totalInputTokens)} / ${formatTokens(usage.totalOutputTokens)}`}
          icon={
            <HugeiconsIcon
              icon={BarChartIcon}
              size={12}
              strokeWidth={1.8}
              className="text-[var(--theme-muted)]"
            />
          }
        />
        <KpiCard
          label="预估总成本"
          value={formatCost(usage.totalEstimatedCostUsd)}
          accent={
            usage.totalEstimatedCostUsd > 0
              ? 'var(--theme-accent)'
              : undefined
          }
          icon={
            <HugeiconsIcon
              icon={CoinsIcon}
              size={12}
              strokeWidth={1.8}
              className="text-[var(--theme-muted)]"
            />
          }
        />
      </div>

      {/* Per-member table */}
      <div>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--theme-muted)]">
          按智能体明细
        </h2>
        <UsageTable usage={usage} members={members} />
      </div>

      {/* Footer: reset + notes */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[var(--theme-muted)]">
          自会话开始累计。{' '}
          <span title="价格基于服务提供方公布的费率，仅供参考。">
            成本为估算值。
          </span>
        </p>
        <button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--theme-border)] px-2.5 py-1.5 text-[10px] text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-danger)] hover:text-[var(--theme-danger)] disabled:opacity-50"
        >
          <HugeiconsIcon icon={Delete01Icon} size={11} />
          清空用量
        </button>
      </div>
    </div>
  )
}
