'use client'

import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SessionUsage as ChartSessionUsage } from '@/lib/chart-utils'
import {
  DialogClose,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatModelName } from '@/lib/format-model-name'
import {
  CHART_DAYS,
  buildDayBuckets,
  formatTokens,
  progressColor,
} from '@/lib/chart-utils'

type ModelUsage = {
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type SessionUsage = {
  id: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  startedAt?: number
  updatedAt?: number
}

type UsageSummary = {
  inputTokens: number
  outputTokens: number
  contextPercent: number
  dailyCost: number
  models: Array<ModelUsage>
  sessions: Array<SessionUsage>
}

type UsageLine = {
  type: 'progress' | 'text' | 'badge'
  label: string
  used?: number
  limit?: number
  format?: 'percent' | 'dollars' | 'tokens'
  value?: string
  color?: string
  resetsAt?: string
}

type ProviderUsage = {
  provider: string
  displayName: string
  status: 'ok' | 'missing_credentials' | 'auth_expired' | 'error'
  message?: string
  plan?: string
  lines: Array<UsageLine>
  updatedAt: number
}

type UsageDetailsModalProps = {
  usage: UsageSummary
  error: string | null
  providerUsage: Array<ProviderUsage>
  providerError: string | null
  providerUpdatedAt: number | null
  onRefreshProviders?: () => Promise<void>
  preferredProvider?: string | null
  onSetPreferredProvider?: (provider: string) => void
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 10 ? 2 : 3,
  }).format(value)
}

function formatTimestamp(value?: number): string {
  if (!value) return '—'
  const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatResetTime(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  if (diffMs <= 0) return '即将重置'
  const hours = Math.floor(diffMs / 3_600_000)
  const mins = Math.floor((diffMs % 3_600_000) / 60_000)
  if (hours > 0) return `${hours} 小时 ${mins} 分钟后重置`
  return `${mins} 分钟后重置`
}


function formatLineValue(line: UsageLine): string {
  if (line.value) return line.value
  if (line.used === undefined) return '—'
  if (line.format === 'dollars') return `$${line.used.toFixed(2)}`
  if (line.format === 'percent') return `${Math.round(line.used)}%`
  if (line.format === 'tokens') return formatTokens(line.used)
  return String(line.used)
}

function ProviderLineRenderer({ line }: { line: UsageLine }) {
  if (
    line.type === 'progress' &&
    line.used !== undefined &&
    line.limit !== undefined
  ) {
    const pct = Math.min((line.used / line.limit) * 100, 100)
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-primary-600">{line.label}</span>
          <span className="font-medium text-primary-900">
            {formatLineValue(line)}
            {line.limit && line.format === 'dollars'
              ? ` / $${line.limit.toFixed(2)}`
              : ''}
            {line.limit && line.format === 'percent' ? '' : ''}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-primary-100">
          <div
            className={`h-2 rounded-full transition-all ${progressColor(line.used, line.limit)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {line.resetsAt ? (
          <div className="text-[10px] text-primary-400">
            {formatResetTime(line.resetsAt)}
          </div>
        ) : null}
      </div>
    )
  }

  if (line.type === 'badge') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-primary-600">{line.label}</span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            backgroundColor: line.color ? `${line.color}20` : '#f3f4f6',
            color: line.color ?? '#6b7280',
          }}
        >
          {line.value ?? '—'}
        </span>
      </div>
    )
  }

  // text
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-primary-600">{line.label}</span>
      <span className="font-medium text-primary-900">
        {formatLineValue(line)}
      </span>
    </div>
  )
}

function getActionableMessage(
  provider: string,
  status: ProviderUsage['status'],
  originalMessage?: string,
): string {
  if (status === 'auth_expired') {
    if (provider === 'claude' || provider === 'codex') {
      const cliCmd = provider === 'claude' ? 'claude' : 'codex'
      return `请在终端运行 \`${cliCmd}\`，重新完成当前会话认证。`
    }
    if (provider === 'openai') {
      return '请在终端运行 `chatgpt` 刷新 ChatGPT 会话，或前往“设置 → 提供方”更新 API Key。'
    }
    return '请重新完成提供方会话认证，或前往“设置 → 提供方”更新 API Key。'
  }

  if (status === 'missing_credentials') {
    return '请前往“设置 → 提供方”填写 API Key，或运行该提供方的 CLI 完成认证。'
  }

  if (status === 'error') {
    return '请检查网络连接后重试；如果问题持续存在，再查看该提供方的状态页。'
  }

  return originalMessage || '暂时无法获取提供方数据。'
}

function statusBadge(status: ProviderUsage['status']) {
  switch (status) {
    case 'ok':
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          已连接
        </span>
      )
    case 'auth_expired':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
          认证已过期
        </span>
      )
    case 'missing_credentials':
      return (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
          未配置
        </span>
      )
    case 'error':
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
          异常
        </span>
      )
    default:
      return null
  }
}

// ── Token trend chart ─────────────────────────────────────────────────────────

function TokenTrendChart({ sessions }: { sessions: Array<SessionUsage> }) {
  const data = useMemo(() => buildDayBuckets(sessions), [sessions])
  const hasData = data.some((d) => d.input > 0 || d.output > 0)

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-primary-200 bg-white/70 p-4">
        <div className="mb-3 text-sm font-semibold text-primary-900">
          令牌用量趋势，最近 {CHART_DAYS} 天
        </div>
        <div className="flex h-28 items-center justify-center text-sm text-primary-400">
          暂无数据，发送一条消息后即可开始追踪。
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-white/70 p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm font-semibold text-primary-900">
          令牌用量趋势，最近 {CHART_DAYS} 天
        </div>
        <div className="flex items-center gap-3 text-[10px] text-primary-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#6366f1] opacity-70" />
            输入
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm bg-[#22c55e] opacity-70" />
            输出
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <defs>
            <linearGradient id="g-input" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-output" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}m`
                : v >= 1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : String(v)
            }
          />
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 11,
            }}
            formatter={(value: number, name: string) => [
              value >= 1000
                ? `${(value / 1000).toFixed(1)}k`
                : String(value),
              name === 'input' ? '输入令牌' : '输出令牌',
            ]}
          />
          <Area
            type="monotone"
            dataKey="input"
            stroke="#6366f1"
            strokeWidth={1.5}
            fill="url(#g-input)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="output"
            stroke="#22c55e"
            strokeWidth={1.5}
            fill="url(#g-output)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function buildCsv(usage: UsageSummary): string {
  const rows: Array<string> = []
  rows.push('用量汇总')
  rows.push('指标,数值')
  rows.push(`输入令牌,${usage.inputTokens}`)
  rows.push(`输出令牌,${usage.outputTokens}`)
  rows.push(`上下文占比,${usage.contextPercent}`)
  rows.push(`当日成本,${usage.dailyCost}`)
  rows.push('')
  rows.push('按模型统计成本')
  rows.push('模型,输入令牌,输出令牌,成本（USD）')
  usage.models.forEach((model) => {
    rows.push(
      `${model.model},${model.inputTokens},${model.outputTokens},${model.costUsd.toFixed(4)}`,
    )
  })
  rows.push('')
  rows.push('会话历史')
  rows.push(
    '会话,模型,输入令牌,输出令牌,成本（USD）,开始时间,最后更新时间',
  )
  usage.sessions.forEach((session) => {
    rows.push(
      `${session.id},${session.model},${session.inputTokens},${session.outputTokens},${session.costUsd.toFixed(4)},${formatTimestamp(session.startedAt)},${formatTimestamp(session.updatedAt)}`,
    )
  })
  return rows.join('\n')
}

// Map provider IDs to their model strings
export function UsageDetailsModal({
  usage,
  error,
  providerUsage,
  providerError,
  providerUpdatedAt,
  onRefreshProviders,
  preferredProvider,
  onSetPreferredProvider,
}: UsageDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'session' | 'providers'>(
    'providers',
  )
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleSetDefault = (provider: string) => {
    onSetPreferredProvider?.(provider)
  }

  const handleRefreshProvider = async () => {
    setIsRefreshing(true)
    try {
      // Force refresh provider data without page reload
      const res = await fetch('/api/provider-usage?force=1')
      if (res.ok && onRefreshProviders) {
        await onRefreshProviders()
      }
      setIsRefreshing(false)
    } catch (error) {
      if (import.meta.env.DEV)
        console.error('Failed to refresh provider data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleExport = () => {
    const csv = buildCsv(usage)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `usage-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex max-h-[80vh] flex-col gap-4 overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <DialogTitle>用量概览</DialogTitle>
          <DialogDescription>
            展示当前 Hermes 会话及已连接提供方的实时用量。
          </DialogDescription>
        </div>
        <DialogClose className="text-primary-700">关闭</DialogClose>
      </div>

      <div className="flex w-fit items-center gap-1 rounded-full border border-primary-100 bg-primary-50 p-1 text-xs">
        {(['session', 'providers'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-full px-3 py-1 font-medium transition ${
              activeTab === tab
                ? 'bg-white text-primary-900 shadow-sm'
                : 'text-primary-600 hover:text-primary-800'
            }`}
          >
            {tab === 'session' ? '会话' : '提供方'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'session' ? (
          <div className="flex flex-col gap-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-primary-200 bg-white/60 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-500">
                  输入令牌
                </div>
                <div className="text-xl font-semibold text-primary-900">
                  {formatTokens(usage.inputTokens)}
                </div>
              </div>
              <div className="rounded-2xl border border-primary-200 bg-white/60 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-500">
                  输出令牌
                </div>
                <div className="text-xl font-semibold text-primary-900">
                  {formatTokens(usage.outputTokens)}
                </div>
              </div>
              <div className="rounded-2xl border border-primary-200 bg-white/60 p-3">
                <div className="text-xs uppercase tracking-wide text-primary-500">
                  当日成本
                </div>
                <div className="text-xl font-semibold text-primary-900">
                  {formatCurrency(usage.dailyCost)}
                </div>
              </div>
            </div>

            <TokenTrendChart sessions={usage.sessions} />

            <div className="rounded-2xl border border-primary-200 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold text-primary-900">
                按模型统计成本
              </div>
              <div className="grid gap-2">
                {usage.models.length === 0 ? (
                  <div className="text-sm text-primary-500">
                    还没有模型用量数据，发送消息后这里会开始统计。
                  </div>
                ) : (
                  usage.models.map((model) => (
                    <div
                      key={model.model}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
                    >
                      <div className="font-medium text-primary-800">
                        {formatModelName(model.model)}
                      </div>
                      <div className="text-primary-600">
                        输入 {formatTokens(model.inputTokens)} · 输出{' '}
                        {formatTokens(model.outputTokens)}
                      </div>
                      <div className="font-semibold text-primary-900">
                        {formatCurrency(model.costUsd)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-primary-200 bg-white/70 p-4">
              <div className="mb-3 text-sm font-semibold text-primary-900">
                会话历史
              </div>
              <div className="grid gap-2">
                {usage.sessions.length === 0 ? (
                  <div className="text-sm text-primary-500">
                    还没有会话数据，开始对话后这里会显示历史记录。
                  </div>
                ) : (
                  usage.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm"
                    >
                      <div>
                        <div className="font-medium text-primary-800">
                          {session.id}
                        </div>
                        <div className="text-xs text-primary-500">
                          {formatModelName(session.model)}
                        </div>
                      </div>
                      <div className="text-primary-600">
                        输入 {formatTokens(session.inputTokens)} · 输出{' '}
                        {formatTokens(session.outputTokens)}
                      </div>
                      <div className="text-xs text-primary-500">
                        {formatTimestamp(session.startedAt)} →{' '}
                        {formatTimestamp(session.updatedAt)}
                      </div>
                      <div className="font-semibold text-primary-900">
                        {formatCurrency(session.costUsd)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-primary-500">
                上下文占用：{Math.round(usage.contextPercent)}%
              </div>
              <Button size="sm" variant="outline" onClick={handleExport}>
                导出 CSV
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {providerError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {providerError}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-primary-500">
                每 30 秒自动刷新 · 最后更新于{' '}
                {formatTimestamp(providerUpdatedAt ?? undefined)}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefreshProvider}
                disabled={isRefreshing}
              >
                {isRefreshing ? '刷新中…' : '刷新'}
              </Button>
            </div>

            <div className="grid gap-3">
              {providerUsage.length === 0 ? (
                <div className="rounded-2xl border border-primary-200 bg-white/70 p-6 text-center">
                  <div className="text-sm font-medium text-primary-700">
                    暂无已连接的提供方，请先在设置中添加提供方再开始对话。
                  </div>
                  <div className="mt-1 text-xs text-primary-500">
                    打开“设置 {'>'} 提供方”连接 Claude CLI 或填写 API Key。
                  </div>
                </div>
              ) : (
                providerUsage.map((provider) => {
                  const isDefault = preferredProvider === provider.provider

                  return (
                    <div
                      key={provider.provider}
                      className={`rounded-2xl border p-4 ${
                        isDefault
                          ? 'border-primary-300 bg-primary-50/50'
                          : 'border-primary-200 bg-white/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-primary-900">
                            {provider.displayName}
                          </div>
                          {provider.plan ? (
                            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                              {provider.plan}
                            </span>
                          ) : null}
                          {isDefault ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              默认
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          {statusBadge(provider.status)}
                          <span className="text-[10px] text-primary-400">
                            {formatTimestamp(provider.updatedAt)}
                          </span>
                        </div>
                      </div>

                      {provider.status !== 'ok' ? (
                        <div className="mt-3 space-y-2">
                          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                            {getActionableMessage(
                              provider.provider,
                              provider.status,
                              provider.message,
                            )}
                          </div>
                          {provider.message &&
                          provider.message !==
                            getActionableMessage(
                              provider.provider,
                              provider.status,
                              provider.message,
                            ) ? (
                            <div className="text-[10px] text-primary-500">
                              详情：{provider.message}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex-1"></div>
                            {!isDefault ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetDefault(provider.provider)
                                }
                                className="rounded-lg border border-primary-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-700 transition hover:bg-primary-50"
                              >
                                设为默认
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-3">
                            {provider.lines.map((line, i) => (
                              <ProviderLineRenderer
                                key={`${line.label}-${i}`}
                                line={line}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
