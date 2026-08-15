/**
 * G4 contract tests — lineage aggregation analytics (management dashboard data source).
 *
 * Coverage (DoD: aggregation logic unit-tested with correctness assertions on 50 users of data):
 *  - Pure function aggregateLineageEvents:
 *      · deterministic events for 50 users (5 departments × 10 users); assert per-user and per-department aggregate fields precisely
 *      · input order independence (shuffled input yields the same result as ordered input)
 *      · empty input → empty summary; no department data → byDept is empty
 *      · run events count toward the total event count without affecting task aggregation
 *  - API GET /api/lineage/summary (real Redis):
 *      · anonymous 401 / regular user 403 / super admin 200
 *      · response summary matches the published lineage events (chart data consistent with the lineage API)
 *
 * The Redis contract suite is skipped entirely when TI_WORK_TEST_REDIS_URL is not set (provided by CI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createContractAuthHarness,
  deleteKeysByPrefix,
  expectJsonStatus,
  invokeRouteHandler,
  makeContractRequest,
  seedUser,
} from './harness/contract-harness'
import { getTestRedisUrl } from './harness/redis-harness'
import type { LineageEvent } from '@/server/lineage-store'
import type * as lineageStore from '@/server/lineage-store'
import { aggregateLineageEvents } from '@/server/lineage-analytics'

const redisUrl = getTestRedisUrl()

const TS = Date.now()
/** Test isolation prefix: avoids polluting production lineage keys */
const PREFIX = `test:analytics:${TS}-${Math.random().toString(36).slice(2, 8)}`

// ── Deterministic 50-user dataset ─────────────────────────────────────────────
// 5 departments × 10 users; 3 tasks per user:
//   tA created only (backlog) → active
//   tB created → backlog → in_progress → done (30 min) → done
//   tC created (todo column) → deleted after 5 minutes → deleted
//   plus 1 run.started + 1 run.completed
const DEPT_COUNT = 5
const USERS_PER_DEPT = 10
const USER_COUNT = DEPT_COUNT * USERS_PER_DEPT

function buildEvent(
  index: number,
  overrides: Partial<LineageEvent>,
): LineageEvent {
  return {
    eventId: `ev-${index}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'task.created',
    taskId: `t-${index}`,
    ownerId: `u-${index}`,
    prevTaskId: null,
    dept: `dept-${index % DEPT_COUNT}`,
    ts: 1_000_000_000_000 + index * 100_000,
    payload: undefined,
    streamId: `1-${index}`,
    ...overrides,
  }
}

/** Builds the deterministic events for the userIdx-th user (ts fully controlled so durations can be asserted) */
function buildUserEvents(userIdx: number): Array<LineageEvent> {
  const base = 1_000_000_000_000 + userIdx * 1_000_000
  const owner = `u-${userIdx}`
  const dept = `dept-${userIdx % DEPT_COUNT}`
  const minutes = (m: number) => m * 60_000
  return [
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-a-created`,
      taskId: `tA-${userIdx}`,
      type: 'task.created',
      ownerId: owner,
      dept,
      ts: base,
      payload: { title: `Task A of ${owner}`, column: 'backlog' },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-b-created`,
      taskId: `tB-${userIdx}`,
      type: 'task.created',
      ownerId: owner,
      dept,
      ts: base + 1000,
      payload: { title: `Task B of ${owner}`, column: 'backlog' },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-b-move-1`,
      taskId: `tB-${userIdx}`,
      type: 'task.moved',
      ownerId: owner,
      dept,
      ts: base + minutes(10),
      payload: { from: 'backlog', column: 'in_progress' },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-b-move-2`,
      taskId: `tB-${userIdx}`,
      type: 'task.moved',
      ownerId: owner,
      dept,
      ts: base + minutes(30),
      payload: { from: 'in_progress', column: 'done' },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-c-created`,
      taskId: `tC-${userIdx}`,
      type: 'task.created',
      ownerId: owner,
      dept,
      ts: base + 2000,
      payload: { title: `Task C of ${owner}`, column: 'todo' },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-c-deleted`,
      taskId: `tC-${userIdx}`,
      type: 'task.deleted',
      ownerId: owner,
      dept,
      ts: base + minutes(5),
      payload: { title: `Task C of ${owner}` },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-run-started`,
      taskId: `tB-${userIdx}`,
      type: 'run.started',
      ownerId: owner,
      dept,
      ts: base + minutes(1),
      payload: { runId: `run-${userIdx}` },
    }),
    buildEvent(userIdx, {
      eventId: `ev-${userIdx}-run-completed`,
      taskId: `tB-${userIdx}`,
      type: 'run.completed',
      ownerId: owner,
      dept,
      ts: base + minutes(20),
      payload: { runId: `run-${userIdx}` },
    }),
  ]
}

function buildFiftyUserDataset(): Array<LineageEvent> {
  const all: Array<LineageEvent> = []
  for (let i = 0; i < USER_COUNT; i += 1) all.push(...buildUserEvents(i))
  return all
}

// ── Pure function aggregation (no Redis, always runs) ─────────────────────────

describe('Lineage aggregation pure function (50-user correctness assertions)', () => {
  it('50-user × 3-task aggregation: per-user fields exact', () => {
    const summary = aggregateLineageEvents(buildFiftyUserDataset())

    expect(summary.totalEvents).toBe(USER_COUNT * 8)
    expect(summary.totalTasks).toBe(USER_COUNT * 3)
    expect(summary.ownerCount).toBe(USER_COUNT)
    expect(summary.deptCount).toBe(DEPT_COUNT)
    expect(summary.byOwner).toHaveLength(USER_COUNT)

    // Per-user exact: 3 tasks = 1 active + 1 done + 1 deleted
    for (let i = 0; i < USER_COUNT; i += 1) {
      const owner = summary.byOwner[i]
      expect(owner.ownerId).toBe(`u-${i}`)
      expect(owner.dept).toBe(`dept-${i % DEPT_COUNT}`)
      expect(owner.totalTasks).toBe(3)
      expect(owner.createdTasks).toBe(3)
      expect(owner.updatedTasks).toBe(0)
      expect(owner.movedTasks).toBe(1) // only tB was ever moved (counted per task)
      expect(owner.deletedTasks).toBe(1)
      expect(owner.completedTasks).toBe(1)
      expect(owner.activeTasks).toBe(1)
      // The only done task took exactly 30 minutes
      expect(owner.avgMinutesToDone).toBe(30)
      expect(owner.columnDistribution).toEqual({
        backlog: 1,
        done: 1,
        deleted: 1,
      })
    }
  })

  it('50-user × 3-task aggregation: per-department fields exact', () => {
    const summary = aggregateLineageEvents(buildFiftyUserDataset())

    expect(summary.byDept).toHaveLength(DEPT_COUNT)
    for (const dept of summary.byDept) {
      expect(dept.dept).toMatch(/^dept-\d$/)
      expect(dept.ownerCount).toBe(USERS_PER_DEPT)
      expect(dept.totalTasks).toBe(USERS_PER_DEPT * 3)
      expect(dept.createdTasks).toBe(USERS_PER_DEPT * 3)
      expect(dept.deletedTasks).toBe(USERS_PER_DEPT)
      expect(dept.completedTasks).toBe(USERS_PER_DEPT)
      expect(dept.activeTasks).toBe(USERS_PER_DEPT)
      expect(dept.avgMinutesToDone).toBe(30)
    }
  })

  it('global column distribution: 50 each of backlog/done/deleted', () => {
    const summary = aggregateLineageEvents(buildFiftyUserDataset())
    const dist = Object.fromEntries(
      summary.columnDistribution.map((c) => [c.column, c.count]),
    )
    expect(dist).toEqual({ backlog: 50, done: 50, deleted: 50 })
  })

  it('flows: 150 entries sorted by creation time, exact status/current column', () => {
    const summary = aggregateLineageEvents(buildFiftyUserDataset())
    expect(summary.flows).toHaveLength(USER_COUNT * 3)

    // Creation times are strictly non-decreasing
    const createdTimes = summary.flows.map((f) => f.createdAt ?? 0)
    for (let i = 1; i < createdTimes.length; i += 1) {
      expect(createdTimes[i]).toBeGreaterThanOrEqual(createdTimes[i - 1])
    }

    const byId = new Map(summary.flows.map((f) => [f.taskId, f]))
    for (let i = 0; i < USER_COUNT; i += 1) {
      const a = byId.get(`tA-${i}`)
      expect(a?.status).toBe('active')
      expect(a?.currentColumn).toBe('backlog')
      expect(a?.firstColumn).toBe('backlog')
      expect(a?.doneAt).toBeNull()

      const b = byId.get(`tB-${i}`)
      expect(b?.status).toBe('done')
      expect(b?.currentColumn).toBe('done')
      expect(b?.firstColumn).toBe('backlog')
      expect(b?.doneAt).not.toBeNull()
      expect(b?.columnsSeen).toEqual(['backlog', 'in_progress', 'done'])
      expect(b?.eventCount).toBe(5) // created + 2 moved + run.started + run.completed

      const c = byId.get(`tC-${i}`)
      expect(c?.status).toBe('deleted')
      expect(c?.currentColumn).toBe('todo')
      expect(c?.deletedAt).not.toBeNull()
      expect(c?.title).toBe(`Task C of u-${i}`)
    }
  })

  it('input order independence: shuffled input matches ordered input', () => {
    const ordered = buildFiftyUserDataset()
    const shuffled = [...ordered].sort(() => 0.5 - Math.random())
    // generatedAt is a call-time timestamp; normalize it for comparison
    const normalize = (s: ReturnType<typeof aggregateLineageEvents>) => ({
      ...s,
      generatedAt: 0,
    })
    expect(normalize(aggregateLineageEvents(shuffled))).toEqual(
      normalize(aggregateLineageEvents(ordered)),
    )
  })

  it('empty input → empty summary (page degrades to a placeholder-less empty state)', () => {
    const summary = aggregateLineageEvents([])
    expect(summary.totalEvents).toBe(0)
    expect(summary.totalTasks).toBe(0)
    expect(summary.ownerCount).toBe(0)
    expect(summary.deptCount).toBe(0)
    expect(summary.byOwner).toEqual([])
    expect(summary.byDept).toEqual([])
    expect(summary.columnDistribution).toEqual([])
    expect(summary.flows).toEqual([])
  })

  it('data without a department does not enter the department report', () => {
    const events = [
      buildEvent(0, { dept: null, taskId: 'x-1' }),
      buildEvent(1, { dept: null, taskId: 'x-2' }),
    ]
    const summary = aggregateLineageEvents(events)
    expect(summary.deptCount).toBe(0)
    expect(summary.byDept).toEqual([])
    expect(summary.ownerCount).toBe(2)
    expect(summary.totalTasks).toBe(2)
  })
})

describe.skipIf(!redisUrl)('Lineage aggregation API contract (real Redis)', () => {
  let store: typeof lineageStore
  let harness: Awaited<ReturnType<typeof createContractAuthHarness>>

  const adminId = `agg-admin-${TS}`
  const regularId = `agg-user-${TS}`
  let adminToken = ''
  let regularToken = ''

  beforeAll(async () => {
    harness = await createContractAuthHarness({
      redisUrl: redisUrl!,
      env: {
        TI_WORK_MULTIUSER: '1',
        TI_WORK_LINEAGE_PREFIX: PREFIX,
      },
      users: [
        seedUser(adminId, 'agg-admin-pw', 'super_admin'),
        seedUser(regularId, 'agg-user-pw', 'regular_admin'),
      ],
    })
    store = await import('@/server/lineage-store')
    adminToken = harness.tokensByUserId[adminId]
    regularToken = harness.tokensByUserId[regularId]

    // Deterministic publishing: alice completed 1 task, bob has 1 active, carol has 1 deleted
    await store.publishLineageEvent({
      eventId: `agg-alice-create-${TS}`,
      type: 'task.created',
      taskId: `agg-t1-${TS}`,
      ownerId: 'alice',
      dept: 'ops',
      payload: { title: 'A', column: 'backlog' },
    })
    await store.publishLineageEvent({
      eventId: `agg-alice-done-${TS}`,
      type: 'task.moved',
      taskId: `agg-t1-${TS}`,
      ownerId: 'alice',
      dept: 'ops',
      payload: { from: 'backlog', column: 'done' },
    })
    await store.publishLineageEvent({
      eventId: `agg-bob-create-${TS}`,
      type: 'task.created',
      taskId: `agg-t2-${TS}`,
      ownerId: 'bob',
      dept: 'sales',
      payload: { title: 'B', column: 'todo' },
    })
    await store.publishLineageEvent({
      eventId: `agg-carol-create-${TS}`,
      type: 'task.created',
      taskId: `agg-t3-${TS}`,
      ownerId: 'carol',
      dept: 'ops',
      payload: { title: 'C', column: 'backlog' },
    })
    await store.publishLineageEvent({
      eventId: `agg-carol-delete-${TS}`,
      type: 'task.deleted',
      taskId: `agg-t3-${TS}`,
      ownerId: 'carol',
      dept: 'ops',
      payload: { title: 'C' },
    })
  })

  afterAll(async () => {
    await deleteKeysByPrefix(harness.redis, PREFIX)
    await harness.cleanup()
  })

  it('anonymous access → 401, regular user → 403', async () => {
    const anon = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.summary',
        'GET',
        makeContractRequest(null, { path: '/api/lineage/summary' }),
      ),
      401,
    )
    expect(String(anon.body.ok)).toBe('false')

    const regular = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.summary',
        'GET',
        makeContractRequest(regularToken, { path: '/api/lineage/summary' }),
      ),
      403,
    )
    expect(String(regular.body.ok)).toBe('false')
  })

  it('super admin access → 200, aggregation matches published lineage events (chart data consistent with the lineage API)', async () => {
    const { body } = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.summary',
        'GET',
        makeContractRequest(adminToken, { path: '/api/lineage/summary' }),
      ),
      200,
    )
    expect(body.ok).toBe(true)
    const summary = body.summary as {
      totalEvents: number
      totalTasks: number
      ownerCount: number
      columnDistribution: Array<{ column: string; count: number }>
      byOwner: Array<{
        ownerId: string
        totalTasks: number
        completedTasks: number
        activeTasks: number
        deletedTasks: number
        avgMinutesToDone: number | null
      }>
      byDept: Array<{
        dept: string
        ownerCount: number
        totalTasks: number
      }>
    }

    expect(summary.totalEvents).toBe(5)
    expect(summary.totalTasks).toBe(3)
    expect(summary.ownerCount).toBe(3)

    const alice = summary.byOwner.find((o) => o.ownerId === 'alice')
    expect(alice?.totalTasks).toBe(1)
    expect(alice?.completedTasks).toBe(1)
    expect(alice?.activeTasks).toBe(0)

    const bob = summary.byOwner.find((o) => o.ownerId === 'bob')
    expect(bob?.totalTasks).toBe(1)
    expect(bob?.activeTasks).toBe(1)
    expect(bob?.deletedTasks).toBe(0)

    const carol = summary.byOwner.find((o) => o.ownerId === 'carol')
    expect(carol?.totalTasks).toBe(1)
    expect(carol?.deletedTasks).toBe(1)

    const dist = Object.fromEntries(
      summary.columnDistribution.map((c) => [c.column, c.count]),
    )
    expect(dist).toEqual({ done: 1, todo: 1, deleted: 1 })

    const ops = summary.byDept.find((d) => d.dept === 'ops')
    expect(ops?.ownerCount).toBe(2)
    expect(ops?.totalTasks).toBe(2)
    const sales = summary.byDept.find((d) => d.dept === 'sales')
    expect(sales?.ownerCount).toBe(1)
    expect(sales?.totalTasks).toBe(1)
  })
})
