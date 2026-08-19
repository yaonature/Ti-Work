'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Clock01Icon,
  Delete01Icon,
  PauseIcon,
  PencilEdit02Icon,
  PlayIcon,
  RefreshIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { CreateJobDialog } from './create-job-dialog'
import { EditJobDialog } from './edit-job-dialog'
import type { HermesJob, RunEvent } from '@/lib/jobs-api'
import type { Status } from '@/components/ds'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { EmptyState, StatusBadge } from '@/components/ds'
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog'
import {
  createJob,
  deleteJob,
  fetchJobOutput,
  fetchJobs,
  pauseJob,
  resumeJob,
  startRun,
  triggerJob,
  updateJob,
} from '@/lib/jobs-api'

const QUERY_KEY = ['hermes', 'jobs'] as const

function formatNextRun(nextRun?: string | null): string {
  if (!nextRun) return '—'
  try {
    const d = new Date(nextRun)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    if (diffMs < 0) return '已逾期'
    if (diffMs < 60_000) return '1 分钟内'
    if (diffMs < 3_600_000) return `约 ${Math.round(diffMs / 60_000)} 分钟后`
    if (diffMs < 86_400_000) return `约 ${Math.round(diffMs / 3_600_000)} 小时后`
    return d.toLocaleDateString()
  } catch {
    return nextRun
  }
}

function formatRunTimestamp(value?: string | null): string {
  if (!value) return '从未运行'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function getOutputPreview(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 200) return normalized
  return `${normalized.slice(0, 200).trimEnd()}…`
}

function getLastRunStatus(job: HermesJob): {
  label: string
  color: string
} {
  if (!job.last_run_at) {
    return {
      label: '从未运行',
      color: 'var(--theme-muted)',
    }
  }
  if (job.last_run_success === true) {
    return {
      label: '上次运行成功',
      color: 'var(--theme-success)',
    }
  }
  if (job.last_run_success === false) {
    return {
      label: '上次运行失败',
      color: 'var(--theme-danger)',
    }
  }
  return {
    label: '上次运行状态未知',
    color: 'var(--theme-muted)',
  }
}

function statusForEvent(ev: RunEvent): { status: Status; label: string } {
  switch (ev.event) {
    case 'tool.started':
    case 'tool.calling':
    case 'tool.pending':
      return { status: 'pending', label: `${ev.name ?? '工具'}…` }
    case 'tool.running':
      return { status: 'running', label: `${ev.name ?? '工具'}运行中…` }
    case 'tool.completed':
      return { status: 'success', label: ev.name ?? '工具' }
    case 'tool.failed':
      return { status: 'error', label: `${ev.name ?? '工具'}失败` }
    case 'reasoning.available':
      return { status: 'running', label: '推理中…' }
    case 'run.completed':
      return { status: 'success', label: '运行完成' }
    case 'run.failed':
      return { status: 'error', label: `运行失败${ev.error ? `：${ev.error}` : ''}` }
    default:
      return { status: 'pending', label: ev.event }
  }
}

function JobCard({
  job,
  onPause,
  onResume,
  onTrigger,
  onDelete,
  onEdit,
  onLiveTrigger,
}: {
  job: HermesJob
  onPause: (id: string) => void
  onResume: (id: string) => void
  onTrigger: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (job: HermesJob) => void
  onLiveTrigger: (job: HermesJob) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [liveLog, setLiveLog] = useState<Array<{ key: string; ev: RunEvent }>>([])
  const [liveOutput, setLiveOutput] = useState('')
  const esRef = useRef<EventSource | null>(null)
  const liveLogBottomRef = useRef<HTMLDivElement | null>(null)
  const isPaused = job.state === 'paused' || !job.enabled
  const isCompleted = job.state === 'completed'
  const lastRunStatus = getLastRunStatus(job)
  const outputQuery = useQuery({
    queryKey: ['hermes', 'jobs', job.id, 'output'],
    queryFn: () => fetchJobOutput(job.id),
    enabled: expanded && !activeRunId,
    staleTime: 30_000,
  })

  // Subscribe to SSE events when a live run is active
  useEffect(() => {
    if (!activeRunId) return
    const es = new EventSource(`/api/hermes-runs/${activeRunId}/events`)
    esRef.current = es
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data as string) as RunEvent
        if (ev.event === 'message.delta') {
          setLiveOutput((prev) => prev + (ev.delta ?? ''))
          return
        }
        setLiveLog((prev) => [
          ...prev,
          { key: `${ev.event}-${ev.timestamp}`, ev },
        ])
        liveLogBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      } catch {
        /* ignore malformed events */
      }
    }
    es.onerror = () => {
      es.close()
      esRef.current = null
    }
    return () => {
      es.close()
      esRef.current = null
    }
  }, [activeRunId])

  // Clear live run state when run.completed/run.failed appears in log
  useEffect(() => {
    const last = liveLog.at(-1)
    if (last && (last.ev.event === 'run.completed' || last.ev.event === 'run.failed')) {
      esRef.current?.close()
      esRef.current = null
      onLiveTrigger(job) // refresh job list
      setActiveRunId(null)
    }
  }, [liveLog, job, onLiveTrigger])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={cn(
        'rounded-xl border p-4 transition-colors',
        'bg-[var(--theme-card)] border-[var(--theme-border)]',
        isPaused && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{
                background: isPaused
                  ? 'var(--theme-muted)'
                  : isCompleted
                    ? 'var(--theme-accent)'
                    : 'var(--theme-text)',
              }}
            />
            <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
              {job.name || '（未命名）'}
            </h3>
          </div>
          <p className="mb-2 line-clamp-2 text-xs text-[var(--theme-muted)]">
            {job.prompt}
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[10px] text-[var(--theme-muted)]">
            <span>{job.schedule_display || '自定义'}</span>
            <span>·</span>
            <span>下次运行：{formatNextRun(job.next_run_at)}</span>
            <span>·</span>
            <span>上次运行：{formatRunTimestamp(job.last_run_at)}</span>
            {job.skills && job.skills.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {job.skills.length} 个技能
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--theme-muted)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: lastRunStatus.color }}
            />
            <span>{lastRunStatus.label}</span>
            {(job.delivery_failures ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                {job.delivery_failures} 次投递失败
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={async () => {
              try {
                const runId = await startRun(job.prompt)
                setLiveLog([])
                setLiveOutput('')
                setActiveRunId(runId)
                setExpanded(true)
              } catch {
                // Fall back to fire-and-forget trigger
                onTrigger(job.id)
              }
            }}
            disabled={activeRunId !== null}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)] disabled:opacity-40"
            title={activeRunId ? '运行中…' : '立即运行（实时）'}
          >
            <HugeiconsIcon
              icon={PlayIcon}
              size={14}
              className="text-[var(--theme-accent)]"
            />
          </button>
          <button
            onClick={() => (isPaused ? onResume(job.id) : onPause(job.id))}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={isPaused ? '恢复' : '暂停'}
          >
            <HugeiconsIcon
              icon={isPaused ? PlayIcon : PauseIcon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onEdit(job)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="编辑"
          >
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => setExpanded((current) => !current)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title={expanded ? '隐藏运行历史' : '显示运行历史'}
          >
            <HugeiconsIcon
              icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
              size={14}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => onDelete(job.id)}
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="删除"
          >
            <HugeiconsIcon
              icon={Delete01Icon}
              size={14}
              style={{ color: 'var(--theme-danger)' }}
            />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-[var(--theme-border)] pt-3">
              {activeRunId ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-[var(--theme-text)]">
                      实时运行
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[var(--theme-accent)]">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--theme-accent)]" />
                      进行中
                    </span>
                  </div>
                  <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3">
                    <div className="space-y-1">
                      {liveLog.length === 0 && (
                        <p className="text-[11px] text-[var(--theme-muted)]">
                          启动中…
                        </p>
                      )}
                      {liveLog.map((entry) => {
                        const { status, label } = statusForEvent(entry.ev)
                        return (
                          <div key={entry.key} className="py-0.5">
                            <StatusBadge status={status} label={label} size="sm" />
                          </div>
                        )
                      })}
                      {liveOutput && (
                        <p className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-[var(--theme-text)]">
                          {liveOutput}
                        </p>
                      )}
                      <div ref={liveLogBottomRef} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-[var(--theme-text)]">
                      运行历史
                    </p>
                    <p className="text-[10px] text-[var(--theme-muted)]">
                      显示最近的输出
                    </p>
                  </div>
                  {outputQuery.isLoading ? (
                    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-xs text-[var(--theme-muted)]">
                      加载输出中…
                    </div>
                  ) : outputQuery.isError ? (
                    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3 text-xs text-[var(--theme-muted)]">
                      加载输出失败。
                    </div>
                  ) : outputQuery.data && outputQuery.data.length > 0 ? (
                    <div className="space-y-2">
                      {outputQuery.data.map((output) => (
                        <div
                          key={`${output.filename}-${output.timestamp}`}
                          className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-3"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--theme-muted)]">
                            <span>{formatRunTimestamp(output.timestamp)}</span>
                            <span className="truncate">{output.filename}</span>
                          </div>
                          <p className="text-xs leading-5 text-[var(--theme-text)]">
                            {getOutputPreview(output.content) ||
                              '无输出内容'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<HugeiconsIcon icon={Clock01Icon} size={28} />}
                      title="还没有运行输出"
                      description="触发此定时任务即可在此查看其运行历史。"
                    />
                  )}
                </>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}

export function JobsScreen() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editingJob, setEditingJob] = useState<HermesJob | null>(null)
  const [pendingDeleteJob, setPendingDeleteJob] = useState<HermesJob | null>(null)

  const jobsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchJobs,
    refetchInterval: 30_000,
  })

  const pauseMutation = useMutation({
    mutationFn: pauseJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已暂停')
    },
  })
  const resumeMutation = useMutation({
    mutationFn: resumeJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已恢复')
    },
  })
  const triggerMutation = useMutation({
    mutationFn: triggerJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已触发')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已删除')
    },
  })
  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已创建')
      setShowCreate(false)
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : '创建定时任务失败', {
        type: 'error',
      })
    },
  })
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      jobId: string
      updates: {
        name: string
        schedule: string
        prompt: string
        deliver?: Array<string>
        skills?: Array<string>
        repeat?: number
      }
    }) => updateJob(payload.jobId, payload.updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
      toast('定时任务已更新')
      setEditingJob(null)
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : '更新定时任务失败', {
        type: 'error',
      })
    },
  })

  const filteredJobs = useMemo(() => {
    const jobs = jobsQuery.data ?? []
    if (!search.trim()) return jobs
    const q = search.toLowerCase()
    return jobs.filter(
      (j) =>
        j.name?.toLowerCase().includes(q) ||
        j.prompt?.toLowerCase().includes(q),
    )
  }, [jobsQuery.data, search])

  const handleCreate = useCallback(
    async (input: {
      name: string
      schedule: string
      prompt: string
      deliver?: Array<string>
      skills?: Array<string>
      repeat?: number
      pre_run_script?: string
    }) => {
      await createMutation.mutateAsync(input)
    },
    [createMutation],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Clock01Icon}
            size={18}
            className="text-[var(--theme-accent)]"
          />
          <h1 className="text-base font-semibold text-[var(--theme-text)]">
            定时任务
          </h1>
          {jobsQuery.data && (
            <span className="ml-1 text-xs text-[var(--theme-muted)]">
              ({jobsQuery.data.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
            }
            className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]"
            title="刷新"
          >
            <HugeiconsIcon
              icon={RefreshIcon}
              size={16}
              className="text-[var(--theme-muted)]"
            />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--theme-accent)' }}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} />
            新建定时任务
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--theme-border)] px-4 py-2">
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]"
          />
          <input
            type="text"
            placeholder="搜索定时任务…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] py-1.5 pl-8 pr-3 text-xs text-[var(--theme-text)] placeholder:text-[var(--theme-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {jobsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--theme-muted)]">
            加载定时任务中…
          </div>
        ) : jobsQuery.isError ? (
          <div
            className="flex items-center justify-center py-12 text-sm"
            style={{ color: 'var(--theme-danger)' }}
          >
            加载定时任务失败：{' '}
            {jobsQuery.error instanceof Error
              ? jobsQuery.error.message
              : '未知错误'}
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={<HugeiconsIcon icon={Clock01Icon} size={40} />}
            title="没有定时任务"
            description="创建一个以开始使用"
          />
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onPause={(id) => pauseMutation.mutate(id)}
                onResume={(id) => resumeMutation.mutate(id)}
                onTrigger={(id) => triggerMutation.mutate(id)}
                onEdit={(job) => setEditingJob(job)}
                onLiveTrigger={() =>
                  void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
                }
                onDelete={() => {
                  setPendingDeleteJob(job)
                }}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <CreateJobDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSubmit={handleCreate}
        isSubmitting={createMutation.isPending}
      />
      <EditJobDialog
        job={editingJob}
        open={editingJob !== null}
        onOpenChange={(open) => {
          if (!open) setEditingJob(null)
        }}
        onSubmit={async (updates) => {
          if (!editingJob) return
          await updateMutation.mutateAsync({
            jobId: editingJob.id,
            updates,
          })
        }}
        isSubmitting={updateMutation.isPending}
      />
      <ConfirmActionDialog
        open={pendingDeleteJob !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteJob(null)
        }}
        title="删除定时任务"
        description={
          pendingDeleteJob ? (
            <>
              确定要删除 <strong>{pendingDeleteJob.name}</strong>{' '}
              吗？删除后将不再自动执行，已有运行记录会保留在历史中。
            </>
          ) : (
            '确定要删除这条定时任务吗？'
          )
        }
        confirmLabel="删除安排"
        onConfirm={() => {
          if (!pendingDeleteJob) return
          deleteMutation.mutate(pendingDeleteJob.id)
          setPendingDeleteJob(null)
        }}
      />
    </div>
  )
}
