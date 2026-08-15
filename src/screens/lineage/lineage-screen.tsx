'use client'

/**
 * Management cockpit (G4) — lineage Gantt chart / column distribution / lineage flow / audit reports.
 *
 * Data source: GET /api/lineage/summary (G3 lineage event aggregation, super_admin only)
 *              GET /api/lineage?taskId= (lineage chain lookup)
 * Interaction: clicking a Gantt bar or picking a task from the dropdown shows the lineage
 *              flow (ancestor chain + direct successors).
 * Charts stay consistent with the lineage API; when Redis has no data we render a real
 * empty state instead of placeholder charts.
 */

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LineageChain } from '@/server/lineage-store'
import { TASK_COLUMN_LABELS } from '@/types/task'
import type { TaskColumn } from '@/types/task'

// ── Types (aligned with lineage-analytics.ts) ───────────────────────────────

type TaskFlowStatus = 'active' | 'done' | 'deleted'

interface LineageFlowTask {
  taskId: string
  ownerId: string
  dept: string | null
  prevTaskId: string | null
  title: string | null
  createdAt: number | null
  updatedAt: number | null
  deletedAt: number | null
  doneAt: number | null
  firstColumn: string | null
  currentColumn: string | null
  status: TaskFlowStatus
  columnsSeen: Array<string>
  eventCount: number
}

interface OwnerAggregate {
  ownerId: string
  dept: string | null
  totalTasks: number
  createdTasks: number
  updatedTasks: number
  movedTasks: number
  deletedTasks: number
  completedTasks: number
  activeTasks: number
  avgMinutesToDone: number | null
  columnDistribution: Record<string, number>
}

interface DeptAggregate {
  dept: string
  ownerCount: number
  totalTasks: number
  createdTasks: number
  deletedTasks: number
  completedTasks: number
  activeTasks: number
  avgMinutesToDone: number | null
}

interface LineageSummary {
  generatedAt: number
  totalEvents: number
  totalTasks: number
  ownerCount: number
  deptCount: number
  columnDistribution: Array<{ column: string; count: number }>
  byOwner: Array<OwnerAggregate>
  byDept: Array<DeptAggregate>
  flows: Array<LineageFlowTask>
}

// ── API ──────────────────────────────────────────────────────────────────────

async function fetchSummary(): Promise<LineageSummary> {
  const res = await fetch('/api/lineage/summary')
  if (res.status === 401 || res.status === 403) {
    throw new Error('需要管理员权限')
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { ok: boolean; summary: LineageSummary }
  return body.summary
}

async function fetchChain(taskId: string): Promise<LineageChain> {
  const url = new URL('/api/lineage', window.location.origin)
  url.searchParams.set('taskId', taskId)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as { ok: boolean; chain: LineageChain }
  return body.chain
}

const summaryQuery = {
  queryKey: ['lineage-summary'],
  queryFn: fetchSummary,
  refetchInterval: 30_000,
  staleTime: 10_000,
}

// ── Visual constants ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<TaskFlowStatus, string> = {
  active: '#6366f1',
  done: '#22c55e',
  deleted: '#ef4444',
}

const COLUMN_COLORS: Array<string> = [
  '#6366f1',
  '#3b82f6',
  '#f59e0b',
  '#22c55e',
  '#a855f7',
  '#ef4444',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function fmtDuration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}秒`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}分钟`
  if (ms < 86_400_000) {
    const h = Math.floor(ms / 3_600_000)
    const m = Math.round((ms % 3_600_000) / 60_000)
    return m > 0 ? `${h}小时 ${m}分` : `${h}小时`
  }
  return `${(ms / 86_400_000).toFixed(1)}天`
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortTaskId(id: string): string {
  return id.length > 14 ? `…${id.slice(-12)}` : id
}

function statusLabel(status: TaskFlowStatus): string {
  return status === 'done' ? '已完成' : status === 'deleted' ? '已删除' : '进行中'
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div
      style={{
        background: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        borderRadius: 12,
        padding: '1rem 1.25rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 2,
          background: `linear-gradient(90deg, ${accent}, ${accent}60, transparent)`,
        }}
      />
      <div
        style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--theme-text-muted)',
          marginBottom: '0.35rem',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: 'var(--theme-text)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: 'var(--theme-card)',
        border: '1px solid var(--theme-border)',
        borderRadius: 12,
        padding: '1rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div
          style={{
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--theme-text-muted)',
          }}
        >
          {title}
        </div>
        {hint && (
          <div style={{ fontSize: '0.7rem', color: 'var(--theme-text-muted)' }}>
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 140,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        color: 'var(--theme-text-muted)',
      }}
    >
      {message}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: 2,
          background: color,
        }}
      />
      <span style={{ fontSize: '0.65rem', color: 'var(--theme-text-muted)' }}>
        {label}
      </span>
    </span>
  )
}

/** Gantt chart tooltip: shows only the task bar itself */
function GanttTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: GanttRow }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--theme-surface-2, #1e1e2e)',
        border: '1px solid var(--theme-border)',
        borderRadius: 8,
        padding: '0.5rem 0.75rem',
        fontSize: 11,
        color: 'var(--theme-text)',
      }}
    >
      <div style={{ fontWeight: 600 }}>{row.title}</div>
      <div style={{ opacity: 0.75 }}>{row.taskId}</div>
      <div>
        {statusLabel(row.status)} · {fmtDuration(row.duration)} · 负责人 {row.ownerId}
      </div>
      <div style={{ opacity: 0.75 }}>
        {fmtTs(row.start)} → {row.end === row.start ? '现在' : fmtTs(row.end)}
      </div>
    </div>
  )
}

interface GanttRow {
  taskId: string
  title: string
  ownerId: string
  status: TaskFlowStatus
  offset: number
  duration: number
  start: number
  end: number
}

// ── Lineage flow ─────────────────────────────────────────────────────────────

function FlowNodeCard({
  taskId,
  title,
  ownerId,
  dept,
  column,
  ts,
  highlighted,
}: {
  taskId: string
  title: string | null
  ownerId: string
  dept: string | null
  column: string | null
  ts: number
  highlighted?: boolean
}) {
  return (
    <div
      style={{
        minWidth: 170,
        maxWidth: 220,
        background: highlighted
          ? 'rgba(59,130,246,0.12)'
          : 'var(--theme-card2, #1a1a24)',
        border: highlighted
          ? '1px solid rgba(59,130,246,0.3)'
          : '1px solid var(--theme-border)',
        borderRadius: 10,
        padding: '0.6rem 0.75rem',
      }}
    >
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--theme-text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title ?? '未命名任务'}
      </div>
      <div
        style={{
          fontSize: '0.62rem',
          fontFamily: 'monospace',
          color: 'var(--theme-text-muted)',
          marginTop: '0.15rem',
        }}
      >
        {shortTaskId(taskId)}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--theme-text-muted)', marginTop: '0.3rem' }}>
        负责人 {ownerId}
        {dept ? ` · ${dept}` : ''}
        {column ? ` · ${TASK_COLUMN_LABELS[column as TaskColumn] ?? column}` : ''}
      </div>
      <div style={{ fontSize: '0.62rem', color: 'var(--theme-text-muted)', marginTop: '0.15rem' }}>
        {fmtTs(ts)}
      </div>
    </div>
  )
}

function FlowArrow() {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        alignItems: 'center',
        color: 'var(--theme-text-muted)',
        fontSize: '0.9rem',
        padding: '0 0.25rem',
      }}
    >
      →
    </div>
  )
}

// ── Main screen ──────────────────────────────────────────────────────────────

export function LineageScreen() {
  const { data, isPending, isError } = useQuery(summaryQuery)

  // Gantt data: normalize task flows to [0, maxEnd - minStart]
  const ganttData = useMemo<Array<GanttRow>>(() => {
    const withTime = (data?.flows ?? []).filter(
      (f): f is LineageFlowTask & { createdAt: number } => f.createdAt !== null,
    )
    if (withTime.length === 0) return []
    const minStart = Math.min(...withTime.map((f) => f.createdAt))
    return withTime
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((f) => {
        const start = f.createdAt
        const end = f.doneAt ?? f.deletedAt ?? f.updatedAt ?? start
        return {
          taskId: f.taskId,
          title: f.title ?? shortTaskId(f.taskId),
          ownerId: f.ownerId,
          status: f.status,
          offset: start - minStart,
          duration: Math.max(end - start, 1),
          start,
          end,
        }
      })
  }, [data])

  const maxGanttMs = useMemo(
    () => ganttData.reduce((acc, g) => Math.max(acc, g.offset + g.duration), 0),
    [ganttData],
  )

  // Lineage flow: default to the first task with a createdAt
  const [selectedTask, setSelectedTask] = useState<string>('')
  useEffect(() => {
    if (!selectedTask && ganttData.length > 0) {
      setSelectedTask(ganttData[0]?.taskId ?? '')
    }
  }, [ganttData, selectedTask])

  const chainQuery = useQuery({
    queryKey: ['lineage-chain', selectedTask],
    queryFn: () => fetchChain(selectedTask),
    enabled: selectedTask.length > 0,
    staleTime: 30_000,
  })

  const totalTasks = data?.totalTasks ?? 0
  const totalEvents = data?.totalEvents ?? 0
  const ownerCount = data?.ownerCount ?? 0
  const deptCount = data?.deptCount ?? 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
      <div>
        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--theme-text)',
            marginBottom: '0.25rem',
          }}
        >
          血缘工作区
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--theme-text-muted)' }}>
          来自 Redis Streams 的跨用户任务血缘 · 每 30 秒自动刷新 · 仅管理员
        </p>
      </div>

      {isError && (
        <div
          style={{
            background: 'var(--theme-error-bg, #2d1b1b)',
            border: '1px solid var(--theme-error, #ef4444)',
            borderRadius: 8,
            padding: '0.75rem 1rem',
            fontSize: '0.8rem',
            color: 'var(--theme-error, #ef4444)',
          }}
        >
          加载血缘摘要失败。需要超级管理员权限。
        </div>
      )}

      {isPending ? (
        <div style={{ color: 'var(--theme-text-muted)', fontSize: '0.85rem' }}>
          加载中…
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
            }}
          >
            <StatCard label="总任务数" value={fmtNum(totalTasks)} accent="#6366f1" />
            <StatCard label="血缘事件" value={fmtNum(totalEvents)} accent="#22c55e" />
            <StatCard label="负责人" value={fmtNum(ownerCount)} accent="#f59e0b" />
            <StatCard label="部门" value={fmtNum(deptCount)} accent="#3b82f6" />
          </div>

          {/* Gantt chart */}
          <SectionCard
            title="任务血缘时间线"
            hint={`${ganttData.length} 项任务 · 点击时间条查看其血缘`}
          >
            {ganttData.length === 0 ? (
              <EmptyState message="暂无血缘数据。发布血缘事件后即可查看时间线。" />
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '0.5rem',
                    fontSize: '0.65rem',
                    color: 'var(--theme-text-muted)',
                  }}
                >
                  <Legend color="#6366f1" label="进行中" />
                  <Legend color="#22c55e" label="已完成" />
                  <Legend color="#ef4444" label="已删除" />
                </div>
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(160, ganttData.length * 20)}
                >
                  <BarChart
                    data={ganttData}
                    layout="vertical"
                    margin={{ top: 0, right: 8, left: 8, bottom: 0 }}
                    barCategoryGap="20%"
                    onClick={(state: { activePayload?: Array<{ payload?: unknown }> } | undefined) => {
                      const row = state?.activePayload?.[0]?.payload as
                        | GanttRow
                        | undefined
                      if (row) setSelectedTask(row.taskId)
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--theme-border)"
                      opacity={0.4}
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      domain={[0, maxGanttMs]}
                      tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) => fmtDuration(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="title"
                      tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      width={150}
                      interval={0}
                    />
                    <Tooltip
                      content={<GanttTooltip />}
                      cursor={{ fill: 'var(--theme-border)', opacity: 0.15 }}
                    />
                    {/* Leader segment: from the timeline origin to the task start (translucent, forms the Gantt shape) */}
                    <Bar
                      dataKey="offset"
                      stackId="g"
                      fill="var(--theme-card2, #1a1a24)"
                      isAnimationActive={false}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="duration"
                      stackId="g"
                      radius={[2, 2, 2, 2]}
                      isAnimationActive={false}
                    >
                      {ganttData.map((row) => (
                        <Cell key={row.taskId} fill={STATUS_COLORS[row.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </SectionCard>

          {/* Column distribution + lineage flow */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <SectionCard title="列分布">
              {data && data.columnDistribution.length === 0 ? (
                <EmptyState message="暂无任务。" />
              ) : (
                (() => {
                  const columnDistData = (data?.columnDistribution ?? []).map(
                    (c) => ({
                      ...c,
                      column: TASK_COLUMN_LABELS[c.column as TaskColumn] ?? c.column,
                    }),
                  )
                  return (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={columnDistData}
                    margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--theme-border)"
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey="column"
                      tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: 'var(--theme-text-muted)' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--theme-surface-2, #1e1e2e)',
                        border: '1px solid var(--theme-border)',
                        borderRadius: 8,
                        fontSize: 11,
                        color: 'var(--theme-text)',
                      }}
                      cursor={{ fill: 'var(--theme-border)', opacity: 0.15 }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {columnDistData.map((c, i) => (
                        <Cell
                          key={c.column}
                          fill={COLUMN_COLORS[i % COLUMN_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                    )
                  })()
              )}
            </SectionCard>

            <SectionCard
              title="血缘流转"
              hint="选择任务以追溯其祖先与后继"
            >
              {ganttData.length === 0 ? (
                <EmptyState message="暂无血缘数据记录。" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <select
                    value={selectedTask}
                    onChange={(e) => setSelectedTask(e.target.value)}
                    style={{
                      background: 'var(--theme-card2, #1a1a24)',
                      border: '1px solid var(--theme-border)',
                      color: 'var(--theme-text)',
                      borderRadius: 8,
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  >
                    {ganttData.map((g) => (
                      <option key={g.taskId} value={g.taskId}>
                        {g.title} ({shortTaskId(g.taskId)})
                      </option>
                    ))}
                  </select>

                  {chainQuery.isError && (
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--theme-error, #ef4444)',
                      }}
                    >
                      加载该任务的血缘链失败。
                    </div>
                  )}

                  {chainQuery.data && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {/* Ancestor chain (including the current node, highlighted) */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                        {chainQuery.data.ancestors.map((node, i) => {
                          const isCurrent = i === chainQuery.data.ancestors.length - 1
                          return (
                            <div
                              key={node.taskId}
                              style={{ display: 'flex', alignItems: 'center' }}
                            >
                              {i > 0 && <FlowArrow />}
                              <FlowNodeCard
                                taskId={node.taskId}
                                title={
                                  typeof node.payload?.title === 'string'
                                    ? node.payload.title
                                    : null
                                }
                                ownerId={node.ownerId}
                                dept={node.dept}
                                column={node.payload?.column as string | null}
                                ts={node.ts}
                                highlighted={isCurrent}
                              />
                            </div>
                          )
                        })}
                      </div>
                      {/* Direct successors */}
                      {chainQuery.data.children.length > 0 && (
                        <>
                          <div
                            style={{
                              fontSize: '0.62rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em',
                              color: 'var(--theme-text-muted)',
                            }}
                          >
                            直接后继
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {chainQuery.data.children.map((node) => (
                              <FlowNodeCard
                                key={node.taskId}
                                taskId={node.taskId}
                                title={
                                  typeof node.payload?.title === 'string'
                                    ? node.payload.title
                                    : null
                                }
                                ownerId={node.ownerId}
                                dept={node.dept}
                                column={node.payload?.column as string | null}
                                ts={node.ts}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Department audit report */}
          <SectionCard title="审计报告 — 按部门">
            {data && data.byDept.length === 0 ? (
              <EmptyState message="暂无部门数据。" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr
                      style={{
                        color: 'var(--theme-text-muted)',
                        textAlign: 'left',
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      <th style={{ padding: '0.35rem 0.5rem' }}>部门</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>负责人</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>任务</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>已完成</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>进行中</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>已删除</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>平均完成时长</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byDept ?? []).map((d) => (
                      <tr
                        key={d.dept}
                        style={{
                          borderTop: '1px solid var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600 }}>{d.dept}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{d.ownerCount}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{d.totalTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#22c55e' }}>
                          {d.completedTasks}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{d.activeTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{d.deletedTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {d.avgMinutesToDone === null
                            ? '—'
                            : `${d.avgMinutesToDone} 分钟`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Owner audit report */}
          <SectionCard title="审计报告 — 按负责人">
            {data && data.byOwner.length === 0 ? (
              <EmptyState message="暂无血缘数据记录。" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                  <thead>
                    <tr
                      style={{
                        color: 'var(--theme-text-muted)',
                        textAlign: 'left',
                        fontSize: '0.62rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      <th style={{ padding: '0.35rem 0.5rem' }}>负责人</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>部门</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>任务</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>移动</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>已完成</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>进行中</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>已删除</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>平均完成时长</th>
                      <th style={{ padding: '0.35rem 0.5rem' }}>列集合</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byOwner ?? []).map((o) => (
                      <tr
                        key={o.ownerId}
                        style={{
                          borderTop: '1px solid var(--theme-border)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, fontFamily: 'monospace' }}>
                          {o.ownerId}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{o.dept ?? '—'}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{o.totalTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{o.movedTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#22c55e' }}>
                          {o.completedTasks}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{o.activeTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{o.deletedTasks}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          {o.avgMinutesToDone === null
                            ? '—'
                            : `${o.avgMinutesToDone} 分钟`}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontSize: '0.68rem', color: 'var(--theme-text-muted)' }}>
                          {Object.entries(o.columnDistribution)
                            .map(([col, count]) => `${col}:${count}`)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
