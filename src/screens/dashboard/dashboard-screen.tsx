import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ReactNode } from 'react'
import type { HermesSession } from '@/server/hermes-api'
import { cn } from '@/lib/utils'
import { EmojiIcon } from '@/components/emoji-icon'
import { stashHighFrequencyReplay } from '@/screens/chat/high-frequency-replay'

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return '刚刚'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`
  return `${Math.floor(diff / 86400)} 天前`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

// ── Glass Card ───────────────────────────────────────────────────

function GlassCard({
  title,
  titleRight,
  accentColor,
  noPadding,
  className,
  children,
}: {
  title?: string
  titleRight?: ReactNode
  accentColor?: string
  noPadding?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-xl border transition-colors',
        className,
      )}
      style={{
        background: 'var(--theme-card)',
        borderColor: 'var(--theme-border)',
      }}
    >
      {accentColor && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}50, transparent)`,
          }}
        />
      )}
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {title}
          </h3>
          {titleRight}
        </div>
      )}
      <div className={cn('flex-1', noPadding ? '' : 'px-5 pb-4 pt-3')}>
        {children}
      </div>
    </div>
  )
}

function EnhancedBadge({ label = '增强 API' }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
      {label}
    </span>
  )
}

function UnavailableWidget({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <GlassCard
      title={title}
      titleRight={<EnhancedBadge />}
      accentColor="#f59e0b"
      className="h-full"
    >
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-card2)] px-4 text-center">
        <p className="text-sm text-muted">{description}</p>
      </div>
    </GlassCard>
  )
}

// ── System Glance (status bar) ───────────────────

function SystemGlance({
  sessions,
  connected,
  model,
  provider,
  tokens,
  cost,
}: {
  sessions: number
  connected: boolean
  model: string
  provider: string
  tokens: string
  cost: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-2.5 backdrop-blur-sm">
      <span
        className={cn(
          'size-2 shrink-0 rounded-full',
          connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500',
        )}
      />
      <div className="flex flex-1 items-center gap-x-4 overflow-x-auto">
        <span className="text-xs font-medium text-ink">{model}</span>
        <span className="text-muted">·</span>
        <span className="text-xs text-neutral-500">{provider}</span>
        <span className="text-muted">·</span>
        <span className="text-xs text-neutral-500">{sessions} 个会话</span>
        <span className="text-muted">·</span>
        <span className="text-xs font-bold tabular-nums text-ink">
          {tokens} Token
        </span>
        <span className="text-muted">·</span>
        <span className="text-xs text-neutral-400">{cost}</span>
      </div>
    </div>
  )
}

// ── Metric Tile ──────────────────────────────────────────────────

function MetricTile({
  label,
  value,
  sub,
  icon,
  accentColor,
}: {
  label: string
  value: string
  sub?: string
  icon: string
  accentColor: string
}) {
  return (
    <GlassCard accentColor={accentColor}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            {label}
          </div>
          <div className="text-2xl font-bold tabular-nums text-ink">
            {value}
          </div>
          {sub && <div className="text-[11px] text-muted">{sub}</div>}
        </div>
        <div
          className="flex size-8 items-center justify-center rounded-lg text-base"
          style={{ background: `${accentColor}15` }}
        >
          <EmojiIcon emoji={icon} size={16} />
        </div>
      </div>
    </GlassCard>
  )
}

// ── Activity Chart ───────────────────────────────────────────────

function ActivityChart({ sessions }: { sessions: Array<HermesSession> }) {
  const chartData = useMemo(() => {
    const dayMap = new Map<string, { sessions: number; messages: number }>()
    const now = Date.now() / 1000
    for (let i = 13; i >= 0; i--) {
      const d = new Date((now - i * 86400) * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      dayMap.set(key, { sessions: 0, messages: 0 })
    }
    for (const s of sessions) {
      if (!s.started_at) continue
      const d = new Date(s.started_at * 1000)
      const key = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const entry = dayMap.get(key)
      if (entry) {
        entry.sessions += 1
        entry.messages += s.message_count ?? 0
      }
    }
    // Trim leading empty days so active days fill the chart rather than
    // showing a long flat line at the start of the window.
    const all = Array.from(dayMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }))
    let firstActive = all.findIndex((d) => d.sessions > 0 || d.messages > 0)
    if (firstActive > 0) firstActive = Math.max(0, firstActive - 1) // keep 1 buffer day
    return firstActive > 0 ? all.slice(firstActive) : all
  }, [sessions])

  return (
    <GlassCard
      title="活动"
      titleRight={<span className="text-[10px] text-muted">最近 14 天</span>}
      accentColor="#6366f1"
      className="h-full"
    >
      <div className="h-[200px] w-full -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          {/* Dual Y-axis: messages (left, larger values) + sessions (right, smaller values).
              Without this, sessions flatlines at zero because message counts dominate
              the shared scale. */}
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 32, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="g-sessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g-messages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#666' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: '#22c55e' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: '#6366f1' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a2e',
                border: '1px solid #333',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              labelStyle={{ color: '#888', fontSize: '10px' }}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="messages"
              stroke="#22c55e"
              fill="url(#g-messages)"
              strokeWidth={1.5}
              dot={false}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="sessions"
              stroke="#6366f1"
              fill="url(#g-sessions)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-5 mt-2 text-[10px] text-neutral-500">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#6366f1]" />
          会话
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#22c55e]" />
          消息
        </span>
      </div>
    </GlassCard>
  )
}

// ── Model Card ───────────────────────────────────────────────────

function ModelCard() {
  const configQuery = useQuery({
    queryKey: ['hermes-config'],
    queryFn: async () => {
      const res = await fetch('/api/hermes-config')
      if (!res.ok) return null
      return res.json() as Promise<Record<string, unknown>>
    },
    staleTime: 30_000,
  })
  const connectionQuery = useQuery({
    queryKey: ['hermes', 'connection-status'],
    queryFn: async () => {
      const res = await fetch('/api/connection-status', { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      return res.json() as Promise<{ status: string; chatReady: boolean }>
    },
    staleTime: 15_000,
  })
  const config = configQuery.data as Record<string, unknown> | undefined
  const modelName = (config?.activeModel ?? '—') as string
  const provider = (config?.activeProvider ?? '—') as string
  const configBlock = config?.config as Record<string, unknown> | undefined
  const modelBlock = configBlock?.model as Record<string, unknown> | undefined
  const baseUrl = (modelBlock?.base_url ??
    configBlock?.base_url ??
    '') as string
  const connected = connectionQuery.data?.chatReady ?? false
  const fallbackBlock = config?.fallback_model as
    | Record<string, unknown>
    | undefined
  const fallbackModel = fallbackBlock?.model as string | undefined

  return (
    <GlassCard
      title="模型"
      titleRight={
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
            connected
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              connected ? 'bg-emerald-500' : 'bg-red-500',
            )}
          />
          {connected ? '在线' : '离线'}
        </span>
      }
      accentColor={connected ? '#22c55e' : '#ef4444'}
      className="h-full"
    >
      <div className="space-y-2">
        <div className="flex items-center gap-3 rounded-lg p-2.5 bg-[var(--theme-card2)] border border-[var(--theme-border)]">
          <div className="flex size-7 items-center justify-center rounded-md bg-indigo-500/10 text-sm">
            <EmojiIcon emoji="🤖" size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[13px] font-bold text-ink truncate">
              {typeof modelName === 'string' ? modelName : '—'}
            </div>
            <div className="text-[10px] text-muted font-mono truncate">
              {provider}
              {baseUrl ? ` · ${baseUrl}` : ''}
            </div>
          </div>
        </div>
        {fallbackModel && (
          <div className="flex items-center gap-3 rounded-lg p-2.5 bg-[var(--theme-card2)] border border-[var(--theme-border)]">
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500/10 text-sm">
              <EmojiIcon emoji="🔄" size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[13px] text-ink truncate">
                {fallbackModel}
              </div>
              <div className="text-[10px] text-muted font-mono truncate">
                {(fallbackBlock?.provider as string) ?? ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

// ── Skills Widget ────────────────────────────────────────────────

function SkillsWidget() {
  const skillsQuery = useQuery({
    queryKey: ['hermes-skills'],
    queryFn: async () => {
      const res = await fetch(
        '/api/skills?tab=installed&limit=8&summary=search',
      )
      if (!res.ok) return []
      const data = await res.json()
      return (data?.skills ?? []) as Array<Record<string, unknown>>
    },
    staleTime: 30_000,
  })

  const skills = skillsQuery.data ?? []

  return (
    <GlassCard
      title="技能"
      titleRight={
        <span className="text-[10px] text-muted">
          已安装 {skills.length} 个
        </span>
      }
      accentColor="#f59e0b"
    >
      {skills.length === 0 ? (
        <div className="text-xs text-neutral-400 py-4 text-center">
          未安装技能
        </div>
      ) : (
        <div className="space-y-1.5">
          {skills.slice(0, 6).map((skill, i) => (
            <div
              key={String(skill.name ?? i)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--theme-card2)] transition-colors"
            >
              <span className="text-xs">
                <EmojiIcon emoji="📦" size={12} />
              </span>
              <span className="text-xs font-medium text-ink truncate flex-1">
                {String(skill.name ?? '未命名')}
              </span>
              {skill.enabled !== false && (
                <span className="size-1.5 rounded-full bg-emerald-500/60" />
              )}
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

// ── Quick Action ─────────────────────────────────────────────────

function QuickAction({
  label,
  icon,
  onClick,
  accentColor,
  disabled,
  badge,
  testId,
}: {
  label: string
  icon: string
  onClick: () => void
  accentColor: string
  disabled?: boolean
  badge?: string
  testId?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={cn(
        'relative overflow-hidden flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition-all',
        'border-[var(--theme-border)] bg-[var(--theme-card)] text-left',
        disabled
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-[var(--theme-accent-border)] hover:scale-[1.01] active:scale-[0.99]',
      )}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm"
        style={{ background: `${accentColor}18` }}
      >
        <EmojiIcon emoji={icon} size={16} />
      </div>
      <span
        className="min-w-0 flex-1 text-xs font-semibold"
        style={{ color: 'var(--theme-text)' }}
      >
        {label}
      </span>
      {badge ? (
        <span className="ml-auto shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
          {badge}
        </span>
      ) : null}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, ${accentColor}, transparent)`,
        }}
      />
    </button>
  )
}

// ── Session Row (minimal) ────────────────────────────────────────

function SessionRow({
  session,
  maxTokens,
  onClick,
}: {
  session: HermesSession
  maxTokens: number
  onClick: () => void
}) {
  const tokens = (session.input_tokens ?? 0) + (session.output_tokens ?? 0)
  const msgs = session.message_count ?? 0
  const tools = session.tool_call_count ?? 0
  const barWidth = maxTokens > 0 ? Math.max(1, (tokens / maxTokens) * 100) : 0

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 rounded-lg hover:bg-[var(--theme-card2)] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[13px] font-medium text-ink truncate flex-1 group-hover:text-ink">
          {session.title || session.id}
        </span>
        <span className="text-[10px] tabular-nums text-muted shrink-0">
          {session.started_at ? timeAgo(session.started_at) : ''}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-neutral-500 mb-1.5">
        {session.model && (
          <span className="font-mono px-1.5 py-0.5 rounded text-[9px] bg-indigo-500/10 text-indigo-400 font-medium">
            {session.model}
          </span>
        )}
        <span>{msgs} 条消息</span>
        {tools > 0 && <span>{tools} 次工具调用</span>}
        {tokens > 0 && <span>{formatNumber(tokens)} Token</span>}
      </div>
      <div className="h-[3px] rounded-full w-full bg-[var(--theme-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${barWidth}%`,
            background: 'linear-gradient(90deg, #6366f1, #a855f7)',
          }}
        />
      </div>
    </button>
  )
}

// ── 高频任务（P1-B 行为资产沉淀 — 工作台露出）────────────────

// 本地只读镜像 API 画像结构，避免把服务端存储模块（Node 依赖）拉进客户端包。
// firstTs/lastTs 仅供服务端排序与周期判定，客户端不消费，不收入镜像。
type HfTaskSample = { value: string; count: number }
type HfTask = {
  taskId: string
  intentCategory: string
  intentAction: string
  intentLabel: string | null
  stepCount: number
  parameterSamples: Array<HfTaskSample>
  occurrenceCount: number
  distinctDays: number
  isPeriodic: boolean
}

// 意图类别展示元数据（英文枚举 → 中文标签 + 强调色 + 图标 key）。
const HF_CATEGORY_META: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  coding: { label: '编码', color: '#6366f1', icon: '💻' },
  research: { label: '调研', color: '#0ea5e9', icon: '🔎' },
  config: { label: '配置', color: '#f59e0b', icon: '⚙️' },
  creative: { label: '创作', color: '#ec4899', icon: '🎨' },
  analysis: { label: '分析', color: '#10b981', icon: '📊' },
}

function HfTaskRow({
  task,
  onReplay,
}: {
  task: HfTask
  onReplay: (task: HfTask) => void
}) {
  const meta = HF_CATEGORY_META[task.intentCategory]
  const accentColor = meta?.color ?? '#10b981'
  const categoryLabel = meta?.label ?? task.intentCategory
  const actionLabel = task.intentAction || ''
  const title =
    task.intentLabel?.trim() || `${categoryLabel} · ${actionLabel}`
  const sampleText = (task.parameterSamples ?? [])
    .slice(0, 2)
    .map((s) => s.value)
    .join('、')
  // 可重放前提：最近一次真实意图措辞。一键重放 = 用该措辞在新会话自动发起
  // 首条消息；缺措辞时无法召回用户原始请求语义，禁用入口，避免把
  // 「类别 · 动作」这类占位拼装句当作真实请求发给 Agent。
  const canReplay = Boolean(task.intentLabel?.trim())

  return (
    <button
      type="button"
      data-testid={`dashboard_high_frequency_replay_${task.taskId}`}
      onClick={() => onReplay(task)}
      disabled={!canReplay}
      aria-disabled={!canReplay}
      title={
        canReplay ? undefined : '该任务暂无历史意图措辞，暂不支持一键重放'
      }
      className="w-full text-left px-4 py-2.5 rounded-lg transition-colors group enabled:hover:bg-[var(--theme-card2)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm"
          style={{ background: `${accentColor}18` }}
        >
          <EmojiIcon emoji={meta?.icon ?? '⚡'} size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink group-hover:text-ink">
              {title}
            </span>
            {task.isPeriodic ? (
              <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                周期
              </span>
            ) : null}
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-emerald-400">
              {task.occurrenceCount} 次
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span>{categoryLabel}</span>
            {actionLabel ? <span>· {actionLabel}</span> : null}
            <span>·</span>
            <span>{task.stepCount} 步模板</span>
            <span>·</span>
            <span>跨 {task.distinctDays} 天</span>
          </div>
          {sampleText ? (
            <div className="mt-0.5 truncate text-[10px] text-neutral-400">
              常用要素：{sampleText}
              {(task.parameterSamples ?? []).length > 2 ? ' 等' : ''}
            </div>
          ) : null}
        </div>
        {canReplay ? (
          <span className="shrink-0 text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            重放 →
          </span>
        ) : (
          <span className="shrink-0 text-[10px] text-neutral-400">
            暂不可重放
          </span>
        )}
      </div>
    </button>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────

export function DashboardScreen() {
  const navigate = useNavigate()
  const sessionsQuery = useQuery({
    // Use a dedicated query key — NOT chatQueryKeys.sessions — to avoid
    // cache collisions with the chat sidebar which fetches fewer sessions
    // and overwrites the dashboard's larger dataset.
    // Also use the workspace proxy (/api/sessions) rather than the server-side
    // listSessions() — the latter calls the gateway via HERMES_API which is
    // only available server-side and returns nothing when called from the client.
    queryKey: ['dashboard', 'sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sessions?limit=200&offset=0')
      if (!res.ok) return []
      const data = (await res.json()) as {
        sessions?: Array<Record<string, unknown>>
      }
      return (data.sessions ?? []).map((s) => ({
        id: (s.key ?? s.id) as string,
        started_at: s.startedAt ? (s.startedAt as number) / 1000 : undefined,
        message_count: (s.message_count as number | undefined) ?? 0,
        tool_call_count: (s.tool_call_count as number | undefined) ?? 0,
        input_tokens: (s.tokenCount as number | undefined) ?? 0,
        output_tokens: 0,
      }))
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  })

  const sessions = (sessionsQuery.data ?? [])

  const stats = useMemo(() => {
    let totalMessages = 0,
      totalToolCalls = 0,
      totalTokens = 0
    for (const s of sessions) {
      totalMessages += s.message_count ?? 0
      totalToolCalls += s.tool_call_count ?? 0
      totalTokens += (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
    }
    return {
      totalSessions: sessions.length,
      totalMessages,
      totalToolCalls,
      totalTokens,
    }
  }, [sessions])

  const recentSessions = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0))
        .slice(0, 6),
    [sessions],
  )

  const maxTokens = useMemo(() => {
    let max = 0
    for (const s of recentSessions) {
      const t = (s.input_tokens ?? 0) + (s.output_tokens ?? 0)
      if (t > max) max = t
    }
    return max
  }, [recentSessions])

  const costEstimate = `~ $${((stats.totalTokens / 1_000_000) * 5).toFixed(2)}`

  // 高频任务画像：服务端在 30 天窗口内对 agent 序列做结构相似度聚类，
  // 结果仅在本地（~/.hermes/habit-sequences/），此处只读露出、点击重放。
  const hfQuery = useQuery({
    queryKey: ['dashboard', 'high-frequency-tasks'],
    queryFn: async () => {
      const res = await fetch('/api/high-frequency-tasks?limit=8')
      if (!res.ok) return { tasks: [], windowDays: 30 }
      const data = (await res.json()) as {
        tasks?: Array<HfTask>
        windowDays?: number
      }
      return { tasks: data.tasks ?? [], windowDays: data.windowDays ?? 30 }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
  const hfTasks = (hfQuery.data?.tasks ?? []).slice(0, 5)
  const hfWindowDays = hfQuery.data?.windowDays ?? 30

  // 点击重放：暂存任务措辞并跳转新会话，聊天屏挂载后自动发起首条消息，
  // 用户可在新会话编辑措辞后再发送（意图措辞可编辑，不盲重放）。
  const handleReplayHighFrequencyTask = useCallback(
    (task: HfTask) => {
      // 复用最近一次真实意图措辞作为新会话首条消息；缺措辞（intentLabel
      // 为空）时 UI 层已禁用入口（HfTaskRow canReplay=false），此处再兜底，
      // 防止把「类别 · 动作」占位拼装句当作真实请求自动发起。
      const message = task.intentLabel?.trim()
      if (!message) return
      stashHighFrequencyReplay({
        message,
        taskLabel: message,
        intentCategory: task.intentCategory,
        intentAction: task.intentAction,
        parameterSamples: task.parameterSamples,
        taskId: task.taskId,
      })
      navigate({
        to: '/chat/$sessionKey',
        params: { sessionKey: 'new' },
      })
    },
    [navigate],
  )

  return (
    <div className="min-h-full px-4 py-4 md:px-8 md:py-6 lg:px-10 space-y-5 pb-28">
      {/* ── Header: Hermes Logo + Quick Actions ── */}
      <div className="flex flex-col items-center gap-3 py-3">
        <img
          src="/ti-work-logo.svg"
          alt="Ti Work"
          className="size-12 md:size-14 rounded-xl shadow-md shadow-indigo-500/10 border border-[var(--theme-border)]"
        />
        <h1 className="text-sm font-semibold text-ink tracking-wide">
          Ti Work
        </h1>
        <div className="mt-1 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction
            label="新建会话"
            icon="💬"
            accentColor="#6366f1"
            onClick={() =>
              navigate({
                to: '/chat/$sessionKey',
                params: { sessionKey: 'new' },
              })
            }
          />
          <QuickAction
            label="执行中心"
            icon="💻"
            accentColor="#22c55e"
            onClick={() => navigate({ to: '/files' })}
            testId="dashboard_quick_action_execution_center"
          />
          <QuickAction
            label="技能"
            icon="🧩"
            accentColor="#f59e0b"
            onClick={() => navigate({ to: '/skills' })}
          />
          <QuickAction
            label="设置"
            icon="⚙️"
            accentColor="#a855f7"
            onClick={() => navigate({ to: '/settings' })}
          />
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile
          label="会话"
          value={formatNumber(stats.totalSessions)}
          icon="💬"
          accentColor="#6366f1"
        />
        <MetricTile
          label="消息"
          value={formatNumber(stats.totalMessages)}
          icon="✉️"
          accentColor="#22c55e"
        />
        <MetricTile
          label="工具调用"
          value={formatNumber(stats.totalToolCalls)}
          icon="🔧"
          accentColor="#f59e0b"
        />
        <MetricTile
          label="Token"
          value={formatNumber(stats.totalTokens)}
          sub={costEstimate}
          icon="⚡"
          accentColor="#a855f7"
        />
      </div>

      {/* ── Charts + Model + Skills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5">
          <ActivityChart sessions={sessions} />
        </div>
        <div className="lg:col-span-4">
          <ModelCard />
        </div>
        <div className="lg:col-span-3">
          <SkillsWidget />
        </div>
      </div>

      {/* ── Recent Sessions (minimal) ── */}
      <GlassCard
        title="最近会话"
        titleRight={
          <button
            type="button"
            className="text-[10px] text-muted hover:text-neutral-300 transition-colors"
            onClick={() =>
              navigate({
                to: '/chat/$sessionKey',
                params: { sessionKey: 'main' },
              })
            }
          >
            查看全部 →
          </button>
        }
        accentColor="#6366f1"
        noPadding
      >
        <div className="py-1">
          {recentSessions.length === 0 ? (
            <div className="text-xs text-neutral-400 py-8 text-center">
              暂无会话 — 开始一段新对话吧！
            </div>
          ) : (
            recentSessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                maxTokens={maxTokens}
                onClick={() =>
                  navigate({
                    to: '/chat/$sessionKey',
                    params: { sessionKey: s.id },
                  })
                }
              />
            ))
          )}
        </div>
      </GlassCard>

      {/* ── 高频任务（P1-B 行为资产沉淀露出，点击一键重放）── */}
      <div data-testid="dashboard_high_frequency_tasks">
        {!hfQuery.isError ? (
          <GlassCard
            title="高频任务"
            titleRight={
              <span className="text-[10px] text-muted">
                {hfTasks.length > 0
                  ? `最近 ${hfWindowDays} 天 · 点击一键重放`
                  : '行为资产沉淀'}
              </span>
            }
            accentColor="#10b981"
            noPadding
          >
            <div className="py-1">
              {hfQuery.isLoading && hfTasks.length === 0 ? (
                <div className="text-xs text-neutral-400 py-8 text-center">
                  正在识别高频任务…
                </div>
              ) : hfTasks.length === 0 ? (
                <div className="text-xs text-neutral-400 py-8 text-center">
                  暂无沉淀 — 让 Agent 重复执行同类任务 3 次后，会在这里沉淀成
                  可一键重放的画像
                </div>
              ) : (
                hfTasks.map((task) => (
                  <HfTaskRow
                    key={task.taskId}
                    task={task}
                    onReplay={handleReplayHighFrequencyTask}
                  />
                ))
              )}
            </div>
          </GlassCard>
        ) : null}
      </div>
    </div>
  )
}
