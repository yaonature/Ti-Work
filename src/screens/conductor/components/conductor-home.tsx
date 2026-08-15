/**
 * Conductor home phase — goal input, quick actions, mission history, persisted restore.
 *
 * Ported from upstream conductor.tsx home rendering with adaptations for
 * the split-component architecture.
 */

import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  PlayIcon,
  Rocket01Icon,
  Search01Icon,
  Settings01Icon,
  TaskDone01Icon,
} from '@hugeicons/core-free-icons'
import { OfficeView } from './office-view'
import { CostTracker  } from './cost-tracker'
import { AGENT_NAMES, getAgentPersona } from './agent-avatar'
import type {CostWorker} from './cost-tracker';
import type { AgentWorkingRow } from './office-view'
import type { MissionHistoryEntry, MissionHistoryWorkerDetail } from '@/types/conductor'
import type { GatewaySession } from '@/lib/gateway-api'
import type { useConductorGateway } from '../hooks/use-conductor-gateway'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/prompt-kit/markdown'
import { Button } from '@/components/ui/button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConductorHomeProps = {
  conductor: ReturnType<typeof useConductorGateway>
  goalDraft: string
  setGoalDraft: (v: string) => void
  onSubmit: () => void
  onSettingsOpen: () => void
}

type QuickActionId = 'research' | 'build' | 'review' | 'deploy'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: Array<{
  id: QuickActionId
  label: string
  icon: typeof Search01Icon
  prompt: string
}> = [
  { id: 'research', label: '调研', icon: Search01Icon, prompt: '调研问题空间，梳理约束条件，比较可选方案，并提出最可行的执行计划。' },
  { id: 'build', label: '构建', icon: PlayIcon, prompt: '端到端交付所需功能，包括实现、验证和简洁的交接总结。' },
  { id: 'review', label: '审查', icon: TaskDone01Icon, prompt: '审查当前实现，检查正确性、潜在回归、缺失测试和发布风险。' },
  { id: 'deploy', label: '部署', icon: Rocket01Icon, prompt: '为部署做好准备，确认发布就绪状态，并总结后续操作。' },
]

const OFFICE_NAMES = AGENT_NAMES.slice(0, 6)
const ACTIVITY_PAGE_SIZE = 3

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(value: string | null | undefined, now: number): string {
  if (!value) return '刚刚'
  const ms = new Date(value).getTime()
  if (!Number.isFinite(ms)) return '刚刚'
  const diffSeconds = Math.max(0, Math.floor((now - ms) / 1000))
  if (diffSeconds < 10) return '刚刚'
  if (diffSeconds < 60) return `${diffSeconds}秒前`
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  return `${diffHours}小时前`
}

function formatDurationRange(startIso: string | null | undefined, endIso: string | null | undefined, now: number): string {
  const startMs = startIso ? new Date(startIso).getTime() : 0
  if (!Number.isFinite(startMs) || startMs === 0) return '0秒'
  const endMs = endIso ? new Date(endIso).getTime() : now
  const totalSeconds = Math.max(0, Math.floor(((Number.isFinite(endMs) ? endMs : now) - startMs) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}小时 ${minutes}分 ${seconds}秒`
  if (minutes > 0) return `${minutes}分 ${seconds}秒`
  return `${seconds}秒`
}

function getShortModelName(model: string | null | undefined): string {
  if (!model) return '未知'
  const parts = model.split('/')
  return parts[parts.length - 1] || model
}

function getActivityFilterLabel(filter: 'all' | 'completed' | 'failed'): string {
  if (filter === 'all') return '全部'
  if (filter === 'completed') return '已完成'
  return '失败'
}

function getSessionStatusLabel(status: 'running' | 'completed' | 'failed'): string {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return '运行中'
}

function deriveSessionStatus(session: GatewaySession): 'running' | 'completed' | 'failed' {
  const updatedMs = new Date(session.updatedAt as string).getTime()
  const staleness = Number.isFinite(updatedMs) ? Date.now() - updatedMs : 0
  const tokens = typeof session.totalTokens === 'number' ? session.totalTokens : 0
  const statusText = `${session.status ?? ''} ${session.state ?? ''}`.toLowerCase()
  if (statusText.includes('error') || statusText.includes('failed')) return 'failed'
  if (tokens > 0 && staleness > 30_000) return 'completed'
  if (staleness > 120_000 && tokens === 0) return 'failed'
  return 'running'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConductorHome({ conductor, goalDraft, setGoalDraft, onSubmit, onSettingsOpen }: ConductorHomeProps) {
  const [missionModalOpen, setMissionModalOpen] = useState(false)
  const [selectedAction, setSelectedAction] = useState<QuickActionId>('build')
  const [activityFilter, setActivityFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [activityPage, setActivityPage] = useState(0)
  const [historyCostExpanded, setHistoryCostExpanded] = useState(false)
  const [now, setNowState] = useState(() => Date.now())

  // Refresh "now" periodically for relative timestamps
  useState(() => {
    const timer = window.setInterval(() => setNowState(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  })

  const selectedHistoryEntry = conductor.selectedHistoryEntry
  const hasMissionHistory = conductor.missionHistory.length > 0

  // Build office rows for idle home view
  const homeOfficeRows = useMemo<Array<AgentWorkingRow>>(() => {
    const sessions = conductor.recentSessions
    if (sessions.length === 0) {
      return OFFICE_NAMES.slice(0, 3).map((name, i) => ({
        id: `placeholder-${i}`,
        name,
        modelId: 'auto',
        status: 'idle' as const,
        lastLine: '等待任务中…',
        taskCount: 0,
        roleDescription: '工作智能体',
      }))
    }
    return sessions.slice(0, 6).map((session, i) => {
      const s = session
      const updatedAt = typeof s.updatedAt === 'string' ? new Date(s.updatedAt).getTime() : 0
      const statusText = `${s.status ?? ''} ${s.kind ?? ''}`.toLowerCase()
      const status: AgentWorkingRow['status'] = /error|failed/.test(statusText) ? 'error'
        : /pause/.test(statusText) ? 'paused'
        : Date.now() - updatedAt < 120_000 ? 'active' : 'idle'
      return {
        id: s.key ?? `session-${i}`,
        name: OFFICE_NAMES[i % OFFICE_NAMES.length],
        modelId: s.model ?? 'auto',
        status,
        lastLine: s.task ?? s.label ?? s.title ?? s.derivedTitle ?? '处理中…',
        lastAt: updatedAt || undefined,
        taskCount: 0,
        roleDescription: s.label ?? '工作智能体',
        sessionKey: s.key ?? undefined,
      }
    })
  }, [conductor.recentSessions])

  // Activity list (history or recent sessions)
  const filteredHistory = useMemo(() => {
    const history = conductor.missionHistory
    if (activityFilter === 'all') return history
    return history.filter((entry) => entry.status === activityFilter)
  }, [conductor.missionHistory, activityFilter])

  const activityItems = hasMissionHistory ? filteredHistory : conductor.recentSessions
  const activityTotalPages = Math.max(1, Math.ceil(activityItems.length / ACTIVITY_PAGE_SIZE))
  const safeActivityPage = Math.min(activityPage, activityTotalPages - 1)
  const visibleActivityItems = activityItems.slice(safeActivityPage * ACTIVITY_PAGE_SIZE, (safeActivityPage + 1) * ACTIVITY_PAGE_SIZE)

  const historyMissionCostWorkers = useMemo<Array<CostWorker>>(
    () =>
      (selectedHistoryEntry?.workerDetails ?? []).map((worker, index) => ({
        id: `${selectedHistoryEntry?.id ?? 'history'}-${index}`,
        label: worker.label,
        totalTokens: worker.totalTokens,
        personaEmoji: worker.personaEmoji,
        personaName: worker.personaName,
      })),
    [selectedHistoryEntry],
  )

  const handleQuickActionSelect = (action: (typeof QUICK_ACTIONS)[number]) => {
    setSelectedAction(action.id)
    setGoalDraft((() => {
      const trimmed = goalDraft.trim()
      if (!trimmed) return `${action.label}: `
      if (trimmed.toLowerCase().startsWith(`${action.label.toLowerCase()}:`)) return goalDraft
      return `${action.label}: ${trimmed}`
    })())
  }

  // ── History detail view ──
  if (selectedHistoryEntry) {
    const historyWorkerDetails = selectedHistoryEntry.workerDetails ?? []
    const historySummary = selectedHistoryEntry.completeSummary ?? selectedHistoryEntry.streamText
    const historyOutputText = selectedHistoryEntry.outputText?.trim() || selectedHistoryEntry.streamText?.trim() || ''
    const historyStatusLabel = selectedHistoryEntry.status === 'completed' ? '已完成' : '已停止'
    const historyStatusClasses =
      selectedHistoryEntry.status === 'completed'
        ? 'border border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
        : 'border border-red-400/35 bg-red-500/10 text-red-300'

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => conductor.setSelectedHistoryEntry(null)}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-border2)] hover:text-[var(--theme-text)]"
        >
          <span aria-hidden="true">&larr;</span> 返回
        </button>

        <div className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className={cn('text-xs font-semibold uppercase tracking-[0.24em]', selectedHistoryEntry.status === 'completed' ? 'text-[var(--theme-accent)]' : 'text-red-400')}>
                {selectedHistoryEntry.status === 'completed' ? '任务已完成' : '任务已停止'}
              </p>
              <h1 className="mt-2 text-xl font-semibold tracking-tight text-[var(--theme-text)] sm:text-2xl">{selectedHistoryEntry.goal}</h1>
              <p className="mt-2 text-xs text-[var(--theme-muted-2)]">
                {selectedHistoryEntry.workerCount}/{Math.max(selectedHistoryEntry.workerCount, 1)} 项任务已完成 &middot; 总耗时 {formatDurationRange(selectedHistoryEntry.startedAt, selectedHistoryEntry.completedAt, now)}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => {
                conductor.setSelectedHistoryEntry(null)
                conductor.resetMission()
              }}
              className="rounded-xl bg-[var(--theme-accent)] px-5 text-white hover:bg-[var(--theme-accent-strong)]"
            >
              新建任务
            </Button>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">智能体摘要</p>
            <span className={cn('rounded-full px-3 py-1 text-xs font-medium', historyStatusClasses)}>
              {historyStatusLabel}
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
            {historySummary ? (
              <Markdown className="max-h-[400px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">{historySummary}</Markdown>
            ) : (
              <p className="text-sm text-[var(--theme-muted)]">暂无摘要。</p>
            )}
          </div>
          {historyWorkerDetails.length > 0 && (
            <div className="mt-4 space-y-2">
              {historyWorkerDetails.map((worker: MissionHistoryWorkerDetail, index) => (
                <div key={`${selectedHistoryEntry.id}-worker-${index}`} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
                  <span className={cn('size-2 rounded-full', selectedHistoryEntry.status === 'completed' ? 'bg-emerald-400' : 'bg-red-400')} />
                  <span className="font-medium text-[var(--theme-text)]">{worker.personaEmoji} {worker.personaName}</span>
                  <span className="text-[var(--theme-muted)]">{worker.label}</span>
                  <span className="ml-auto text-xs text-[var(--theme-muted)]">{getShortModelName(worker.model)} &middot; {worker.totalTokens.toLocaleString()} token</span>
                </div>
              ))}
            </div>
          )}
          {(selectedHistoryEntry.totalTokens > 0 || historyMissionCostWorkers.length > 0) && (
            <div className="mt-4">
              <CostTracker
                totalTokens={selectedHistoryEntry.totalTokens}
                workers={historyMissionCostWorkers}
                expanded={historyCostExpanded}
                onToggle={() => setHistoryCostExpanded((c) => !c)}
              />
            </div>
          )}
        </section>

        {historyOutputText && (
          <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-6 shadow-[0_24px_80px_var(--theme-shadow)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--theme-muted)]">执行输出</p>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-5 py-4">
              <Markdown className="max-h-[600px] max-w-none overflow-auto text-sm text-[var(--theme-text)]">{historyOutputText}</Markdown>
            </div>
          </section>
        )}

        {!historySummary && historyWorkerDetails.length === 0 && !historyOutputText && (
          <section className="overflow-hidden rounded-3xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-card)] p-6">
            <p className="text-center text-sm text-[var(--theme-muted)]">
              该任务没有详细的输出记录。
            </p>
          </section>
        )}
      </div>
    )
  }

  // ── Default home view ──
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <div className="relative flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.24em] text-[var(--theme-muted)]">
            任务指挥中心
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="absolute right-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMissionModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--theme-accent)] p-2 text-white shadow-sm transition-colors hover:bg-[var(--theme-accent-strong)]"
              aria-label="新建任务"
            >
              <HugeiconsIcon icon={Rocket01Icon} size={18} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              onClick={onSettingsOpen}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-2 text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
              aria-label="打开调度设置"
            >
              <HugeiconsIcon icon={Settings01Icon} size={18} strokeWidth={1.7} />
            </button>
          </div>
        </div>
        <p className="text-sm text-[var(--theme-muted-2)]">发起一项任务，实时观看智能体团队协同工作。</p>
      </div>

      {conductor.hasPersistedMission && (
        <div className="rounded-2xl border border-[var(--theme-accent)]/30 bg-[var(--theme-accent-soft)] px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--theme-text)]">之前的任务仍在运行，是否从中断处继续？</p>
            <Button
              type="button"
              onClick={() => setMissionModalOpen(true)}
              className="rounded-xl bg-[var(--theme-accent)] px-4 text-white hover:bg-[var(--theme-accent-strong)]"
            >
              继续任务
            </Button>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-[0_24px_80px_var(--theme-shadow)] md:h-[520px]">
        <OfficeView
          agentRows={homeOfficeRows}
          missionRunning={homeOfficeRows.some((a) => a.status === 'active')}
          onViewOutput={() => {}}
          processType="parallel"
          companyName=""
          containerHeight={520}
          hideHeader
        />
      </section>

      {(hasMissionHistory || conductor.recentSessions.length > 0) ? (
        <section className="mt-6 w-full space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--theme-muted)]">最近任务</h2>
            {activityTotalPages > 1 && (
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--theme-muted-2)]">{safeActivityPage + 1}/{activityTotalPages}</span>
                <button
                  type="button"
                  disabled={safeActivityPage === 0}
                  onClick={() => setActivityPage((p) => Math.max(0, p - 1))}
                  className="inline-flex size-6 items-center justify-center rounded-lg border border-[var(--theme-border)] text-xs text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] disabled:opacity-30"
                >
                  &lsaquo;
                </button>
                <button
                  type="button"
                  disabled={safeActivityPage >= activityTotalPages - 1}
                  onClick={() => setActivityPage((p) => Math.min(activityTotalPages - 1, p + 1))}
                  className="inline-flex size-6 items-center justify-center rounded-lg border border-[var(--theme-border)] text-xs text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] disabled:opacity-30"
                >
                  &rsaquo;
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(['all', 'completed', 'failed'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => { setActivityFilter(filter); setActivityPage(0) }}
                className={cn(
                  'rounded-full border px-3 py-1 text-[11px] font-medium capitalize transition-colors',
                  activityFilter === filter
                    ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                    : 'border-[var(--theme-border)] text-[var(--theme-muted-2)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-text)]',
                )}
              >
                {getActivityFilterLabel(filter)}
              </button>
            ))}
          </div>
          {visibleActivityItems.length > 0 ? (
            <div className="min-h-[140px] space-y-1.5">
              {hasMissionHistory
                ? visibleActivityItems.map((item) => {
                    const entry = item as MissionHistoryEntry
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => conductor.setSelectedHistoryEntry(entry)}
                        className="flex w-full items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-left text-sm transition-colors hover:border-[var(--theme-accent)]"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-[var(--theme-text)]">{entry.goal}</span>
                        <span
                          className={cn(
                            'w-[76px] shrink-0 rounded-full border px-2 py-0.5 text-center text-[10px] font-medium uppercase tracking-[0.12em]',
                            entry.status === 'completed'
                              ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                              : 'border-red-400/35 bg-red-500/10 text-red-300',
                          )}
                        >
                          {entry.status === 'completed' ? '已完成' : '失败'}
                        </span>
                        <span className="w-[52px] shrink-0 text-right text-xs text-[var(--theme-muted-2)]">{formatRelativeTime(entry.completedAt, now)}</span>
                        <span className="w-[72px] shrink-0 text-right text-xs text-[var(--theme-muted)]">{entry.totalTokens.toLocaleString()} token</span>
                      </button>
                    )
                  })
                : visibleActivityItems.map((item, i) => {
                    const session = item as GatewaySession
                    const label = session.label ?? session.key ?? ''
                    const displayName = label.replace(/^worker-/, '').replace(/[-_]+/g, ' ')
                    const tokens = typeof session.totalTokens === 'number' ? session.totalTokens : 0
                    const updatedAt = typeof session.updatedAt === 'string' ? session.updatedAt : null
                    const sessionStatus = deriveSessionStatus(session)
                    const dotClass = sessionStatus === 'completed' ? 'bg-emerald-400' : sessionStatus === 'failed' ? 'bg-red-400' : 'bg-sky-400 animate-pulse'

                    return (
                      <div
                        key={session.key ?? `session-${i}`}
                        className="flex items-center gap-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium capitalize text-[var(--theme-text)]">{displayName}</span>
                        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]',
                          sessionStatus === 'completed' ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300'
                            : sessionStatus === 'failed' ? 'border-red-400/35 bg-red-500/10 text-red-300'
                            : 'border-sky-400/35 bg-sky-500/10 text-sky-300',
                        )}>
                          <span className={cn('mr-1 inline-block size-1.5 rounded-full align-middle', dotClass)} />
                          {getSessionStatusLabel(sessionStatus)}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--theme-muted-2)]">{formatRelativeTime(updatedAt, now)}</span>
                        <span className="shrink-0 text-xs text-[var(--theme-muted)]">{tokens.toLocaleString()} token</span>
                      </div>
                    )
                  })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-6 text-center text-sm text-[var(--theme-muted)]">
              未找到{hasMissionHistory ? '任务' : '会话'}记录{activityFilter === 'all' ? '' : `（${getActivityFilterLabel(activityFilter)}）`}
            </div>
          )}
        </section>
      ) : (
        <section className="mt-6 w-full">
          <div className="rounded-xl border border-dashed border-[var(--theme-border)] px-4 py-8 text-center">
            <p className="text-sm text-[var(--theme-muted)]">还没有任务。</p>
            <p className="mt-1 text-xs text-[var(--theme-muted-2)]">发起第一个任务后，它会显示在这里。</p>
          </div>
        </section>
      )}

      {/* Mission launch modal */}
      {missionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onClick={() => setMissionModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-[20px] border border-[var(--theme-border2)] bg-[var(--theme-panel)] p-5 shadow-[var(--theme-shadow-3)] sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-[var(--theme-text)]">新建任务</h2>
                <p className="mt-1 text-sm text-[var(--theme-muted-2)]">描述目标、约束条件和预期结果。</p>
              </div>
              <button
                type="button"
                onClick={() => setMissionModalOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] text-lg text-[var(--theme-muted)] transition-colors hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]"
                aria-label="关闭新建任务对话框"
              >
                &times;
              </button>
            </div>

            <form
              className="mt-5 space-y-4"
              onSubmit={(e) => { e.preventDefault(); setMissionModalOpen(false); onSubmit() }}
            >
              <div className="flex flex-wrap gap-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleQuickActionSelect(action)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      selectedAction === action.id
                        ? 'border-[var(--theme-accent)] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-strong)]'
                        : 'border-[var(--theme-border)] bg-transparent text-[var(--theme-muted)] hover:border-[var(--theme-accent)] hover:text-[var(--theme-accent-strong)]',
                    )}
                  >
                    <HugeiconsIcon icon={action.icon} size={14} strokeWidth={1.7} />
                    {action.label}
                  </button>
                ))}
              </div>

              <textarea
                value={goalDraft}
                onChange={(e) => setGoalDraft(e.target.value)}
                placeholder={`${QUICK_ACTIONS.find((a) => a.id === selectedAction)?.label ?? '构建'}：描述目标、约束条件和预期结果。`}
                disabled={conductor.isSending}
                rows={8}
                className="min-h-[220px] w-full rounded-3xl border border-[var(--theme-border2)] bg-[var(--theme-bg)] px-4 py-4 text-sm text-[var(--theme-text)] outline-none transition-colors placeholder:text-[var(--theme-muted-2)] focus:border-[var(--theme-accent)] disabled:cursor-not-allowed disabled:opacity-60 md:text-base"
              />

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!goalDraft.trim() || conductor.isSending}
                  className="rounded-full bg-[var(--theme-accent)] px-5 text-white hover:bg-[var(--theme-accent-strong)]"
                >
                  {conductor.isSending ? '正在启动…' : '发起任务'}
                  <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={1.7} />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
