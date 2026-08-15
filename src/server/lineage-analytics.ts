/**
 * G4 management cockpit — lineage aggregation analysis.
 *
 * Input: the lineage event stream (lineage-store.replayLineageEvents full direct read)
 * Output: cross-user/cross-department aggregate stats + task flows (gantt chart / audit
 * report data source)
 *
 * Design principles:
 *  - aggregateLineageEvents is a pure function (no I/O); the aggregation logic can be
 *    unit-tested in isolation (DoD: correctness assertions on 50-user data, no real Redis
 *    required)
 *  - getLineageSummary handles data fetching (real Redis Streams) and hands it to the pure
 *    aggregation function
 *  - When Redis is unavailable, an empty summary is returned and the page degrades
 *    gracefully to an empty state (no placeholder charts)
 *
 * Aggregation semantics:
 *  - Task status: has task.deleted → deleted; once flowed to the done column → done;
 *    otherwise active
 *  - Column distribution: deleted tasks go into the deleted column; others use the latest
 *    column (currentColumn)
 *  - avgMinutesToDone: only counts tasks created within the lineage event stream that
 *    reached done
 */
import { replayLineageEvents } from './lineage-store'
import type { LineageEvent } from './lineage-store'

/** Event cap for a single aggregation read (50-user event volume is far below this) */
const MAX_SUMMARY_EVENTS = 100_000

export type TaskFlowStatus = 'active' | 'done' | 'deleted'

/** Single-task flow (one gantt chart row / one audit report row) */
export interface LineageFlowTask {
  taskId: string
  ownerId: string
  dept: string | null
  prevTaskId: string | null
  title: string | null
  createdAt: number | null
  updatedAt: number | null
  deletedAt: number | null
  /** Time the task reached the done column (null when not completed) */
  doneAt: number | null
  firstColumn: string | null
  currentColumn: string | null
  status: TaskFlowStatus
  /** Columns the task passed through (including the starting one) */
  columnsSeen: Array<string>
  eventCount: number
}

/** Aggregated by owning user */
export interface OwnerAggregate {
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

/** Aggregated by department */
export interface DeptAggregate {
  dept: string
  ownerCount: number
  totalTasks: number
  createdTasks: number
  deletedTasks: number
  completedTasks: number
  activeTasks: number
  avgMinutesToDone: number | null
}

/** Cockpit aggregation summary */
export interface LineageSummary {
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

interface TaskAccum {
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
  columnsSeen: Set<string>
  eventCount: number
  sawUpdated: boolean
  sawMoved: boolean
}

interface OwnerAccum {
  ownerId: string
  dept: string | null
  totalTasks: number
  createdTasks: number
  updatedTasks: number
  movedTasks: number
  deletedTasks: number
  completedTasks: number
  activeTasks: number
  doneMinutes: Array<number>
  columnDistribution: Record<string, number>
}

interface DeptAccum {
  dept: string
  owners: Set<string>
  totalTasks: number
  createdTasks: number
  deletedTasks: number
  completedTasks: number
  activeTasks: number
  doneMinutes: Array<number>
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function taskColumn(ev: LineageEvent): string | null {
  return asString(ev.payload?.column)
}

function taskTitle(ev: LineageEvent): string | null {
  const t = asString(ev.payload?.title)
  if (t) return t
  const updates = ev.payload?.updates
  if (updates && typeof updates === 'object') {
    return asString((updates as Record<string, unknown>).title)
  }
  return null
}

function moveFrom(ev: LineageEvent): string | null {
  return asString(ev.payload?.from)
}

/**
 * Pure function: aggregate a lineage event stream into a cockpit summary.
 * Event order is not guaranteed (events for the same task are sorted by ts, then the latest
 * state is taken).
 */
export function aggregateLineageEvents(
  events: ReadonlyArray<LineageEvent>,
): LineageSummary {
  const tasks = new Map<string, TaskAccum>()

  // Group by task, then sort by ts before processing, so the pure function result is
  // independent of input order
  const byTask = new Map<string, Array<LineageEvent>>()
  for (const ev of events) {
    const list = byTask.get(ev.taskId)
    if (list) list.push(ev)
    else byTask.set(ev.taskId, [ev])
  }

  for (const list of byTask.values()) {
    list.sort((a, b) => a.ts - b.ts)
    const first = list[0]
    const t: TaskAccum = {
      taskId: first.taskId,
      ownerId: first.ownerId,
      dept: first.dept ?? null,
      prevTaskId: first.prevTaskId ?? null,
      title: null,
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
      doneAt: null,
      firstColumn: null,
      currentColumn: null,
      columnsSeen: new Set<string>(),
      eventCount: 0,
      sawUpdated: false,
      sawMoved: false,
    }
    tasks.set(first.taskId, t)

    for (const ev of list) {
      t.eventCount += 1

      switch (ev.type) {
      case 'task.created': {
        t.createdAt = t.createdAt ?? ev.ts
        const title = taskTitle(ev)
        if (title && !t.title) t.title = title
        const column = taskColumn(ev)
        if (column) {
          t.firstColumn = t.firstColumn ?? column
          t.currentColumn = column
          t.columnsSeen.add(column)
        }
        break
      }
      case 'task.updated': {
        t.sawUpdated = true
        t.updatedAt = Math.max(t.updatedAt ?? 0, ev.ts)
        const title = taskTitle(ev)
        if (title && !t.title) t.title = title
        break
      }
      case 'task.moved': {
        t.sawMoved = true
        t.updatedAt = Math.max(t.updatedAt ?? 0, ev.ts)
        const column = taskColumn(ev)
        if (column) {
          const from = moveFrom(ev)
          if (from) t.columnsSeen.add(from)
          t.columnsSeen.add(column)
          t.currentColumn = column
          if (column === 'done') t.doneAt = ev.ts
        }
        break
      }
      case 'task.deleted': {
        t.deletedAt = ev.ts
        break
      }
      default:
        break
      }
    }
  }

  const owners = new Map<string, OwnerAccum>()
  const depts = new Map<string, DeptAccum>()
  const globalColumns: Record<string, number> = {}
  const flows: Array<LineageFlowTask> = []

  for (const t of tasks.values()) {
    // Task status
    const status: TaskFlowStatus =
      t.deletedAt !== null ? 'deleted' : t.doneAt !== null ? 'done' : 'active'

    flows.push({
      taskId: t.taskId,
      ownerId: t.ownerId,
      dept: t.dept,
      prevTaskId: t.prevTaskId,
      title: t.title,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      deletedAt: t.deletedAt,
      doneAt: t.doneAt,
      firstColumn: t.firstColumn,
      currentColumn: t.currentColumn,
      status,
      columnsSeen: [...t.columnsSeen],
      eventCount: t.eventCount,
    })

    // Column distribution (deleted tasks go into the deleted column)
    const colKey = t.deletedAt !== null ? 'deleted' : (t.currentColumn ?? 'unknown')
    globalColumns[colKey] = (globalColumns[colKey] ?? 0) + 1

    // Aggregate by user
    let o = owners.get(t.ownerId)
    if (!o) {
      o = {
        ownerId: t.ownerId,
        dept: t.dept,
        totalTasks: 0,
        createdTasks: 0,
        updatedTasks: 0,
        movedTasks: 0,
        deletedTasks: 0,
        completedTasks: 0,
        activeTasks: 0,
        doneMinutes: [],
        columnDistribution: {},
      }
      owners.set(t.ownerId, o)
    }
    o.totalTasks += 1
    if (t.createdAt !== null) o.createdTasks += 1
    if (t.sawUpdated) o.updatedTasks += 1
    if (t.sawMoved) o.movedTasks += 1
    if (t.deletedAt !== null) o.deletedTasks += 1
    if (t.doneAt !== null) {
      o.completedTasks += 1
      if (t.createdAt !== null) o.doneMinutes.push((t.doneAt - t.createdAt) / 60000)
    }
    if (status === 'active') o.activeTasks += 1
    o.columnDistribution[colKey] = (o.columnDistribution[colKey] ?? 0) + 1

    // Aggregate by department (data without a department does not enter the department report)
    if (t.dept) {
      let d = depts.get(t.dept)
      if (!d) {
        d = {
          dept: t.dept,
          owners: new Set<string>(),
          totalTasks: 0,
          createdTasks: 0,
          deletedTasks: 0,
          completedTasks: 0,
          activeTasks: 0,
          doneMinutes: [],
        }
        depts.set(t.dept, d)
      }
      d.owners.add(t.ownerId)
      d.totalTasks += 1
      if (t.createdAt !== null) d.createdTasks += 1
      if (t.deletedAt !== null) d.deletedTasks += 1
      if (t.doneAt !== null) {
        d.completedTasks += 1
        if (t.createdAt !== null) d.doneMinutes.push((t.doneAt - t.createdAt) / 60000)
      }
      if (status === 'active') d.activeTasks += 1
    }
  }

  const avgMinutes = (minutes: Array<number>): number | null =>
    minutes.length === 0
      ? null
      : Math.round((minutes.reduce((a, b) => a + b, 0) / minutes.length) * 10) / 10

  const byOwner: Array<OwnerAggregate> = [...owners.values()]
    .map((o) => ({
      ownerId: o.ownerId,
      dept: o.dept,
      totalTasks: o.totalTasks,
      createdTasks: o.createdTasks,
      updatedTasks: o.updatedTasks,
      movedTasks: o.movedTasks,
      deletedTasks: o.deletedTasks,
      completedTasks: o.completedTasks,
      activeTasks: o.activeTasks,
      avgMinutesToDone: avgMinutes(o.doneMinutes),
      columnDistribution: o.columnDistribution,
    }))
    .sort(
      (a, b) =>
        b.totalTasks - a.totalTasks ||
        a.ownerId.localeCompare(b.ownerId, undefined, { numeric: true }),
    )

  const byDept: Array<DeptAggregate> = [...depts.values()]
    .map((d) => ({
      dept: d.dept,
      ownerCount: d.owners.size,
      totalTasks: d.totalTasks,
      createdTasks: d.createdTasks,
      deletedTasks: d.deletedTasks,
      completedTasks: d.completedTasks,
      activeTasks: d.activeTasks,
      avgMinutesToDone: avgMinutes(d.doneMinutes),
    }))
    .sort(
      (a, b) =>
        b.totalTasks - a.totalTasks ||
        a.dept.localeCompare(b.dept, undefined, { numeric: true }),
    )

  const columnDistribution = Object.entries(globalColumns)
    .map(([column, count]) => ({ column, count }))
    .sort((a, b) => b.count - a.count || a.column.localeCompare(b.column))

  flows.sort((a, b) => {
    const ta = a.createdAt ?? a.updatedAt ?? 0
    const tb = b.createdAt ?? b.updatedAt ?? 0
    return ta - tb || a.taskId.localeCompare(b.taskId)
  })

  return {
    generatedAt: Date.now(),
    totalEvents: events.length,
    totalTasks: tasks.size,
    ownerCount: owners.size,
    deptCount: depts.size,
    columnDistribution,
    byOwner,
    byDept,
    flows,
  }
}

/**
 * Read the lineage event stream and aggregate it into a cockpit summary.
 * When Redis is unavailable, returns an empty summary (page degrades to an empty state,
 * no error thrown).
 */
export async function getLineageSummary(): Promise<LineageSummary> {
  const events = await replayLineageEvents('-', MAX_SUMMARY_EVENTS)
  return aggregateLineageEvents(events)
}
