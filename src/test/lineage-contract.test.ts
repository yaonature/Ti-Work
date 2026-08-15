/**
 * G3 contract tests — lineage communication layer (real Redis Streams).
 *
 * Coverage (DoD: complete lineage chains, recoverable consumer groups, idempotent writes, no message loss):
 *  - store: publish write / eventId idempotency / consumer group consume + ack /
 *           XPENDING+XCLAIM recovery (Redis 5 compatible, no XAUTOCLAIM) /
 *           XRANGE replay does not change consumption state / prevTaskId lineage chain (ancestors + successors) / field contract
 *  - API: POST /api/lineage (401/201/idempotent 200/400/503 degradation),
 *         GET  /api/lineage?taskId= (200/404/400),
 *         GET  /api/lineage/events (super_admin only, 401/403/200)
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
import type * as lineageStore from '@/server/lineage-store'

const redisUrl = getTestRedisUrl()

const TS = Date.now()
/** Test isolation prefix: avoids polluting production lineage keys */
const PREFIX = `test:lineage:${TS}-${Math.random().toString(36).slice(2, 8)}`

describe.skipIf(!redisUrl)('Lineage communication layer contract (real Redis Streams)', () => {
  let store: typeof lineageStore
  let harness: Awaited<ReturnType<typeof createContractAuthHarness>>

  const adminId = `lineage-admin-${TS}`
  const regularId = `lineage-user-${TS}`
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
        seedUser(adminId, 'lineage-admin-pw', 'super_admin'),
        seedUser(regularId, 'lineage-user-pw', 'regular_admin'),
      ],
    })
    store = await import('@/server/lineage-store')
    adminToken = harness.tokensByUserId[adminId]
    regularToken = harness.tokensByUserId[regularId]
  })

  afterAll(async () => {
    await deleteKeysByPrefix(harness.redis, PREFIX)
    await harness.cleanup()
  })

  // ── store layer: write / idempotency ──────────────────────────────────

  it('publish writes to the event stream with a complete field contract (task/run/owner/prev_task/ts/dept)', async () => {
    const taskId = `t-created-${TS}`
    const result = await store.publishLineageEvent({
      eventId: `ev-created-${TS}`,
      type: 'task.created',
      taskId,
      runId: 'run-1',
      ownerId: 'alice',
      prevTaskId: null,
      dept: 'ops',
      payload: { title: 'Onboard new vendor' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok || result.duplicate) throw new Error('unexpected publish')
    expect(result.event.streamId).toMatch(/^\d+-\d+$/)
    expect(result.event.ts).toBeGreaterThan(0)

    const count = await store.countLineageEvents()
    expect(count).toBeGreaterThanOrEqual(1)

    // Replay to verify complete fields
    const events = await store.replayLineageEvents('-', 10)
    const ev = events.find((e) => e.eventId === `ev-created-${TS}`)
    expect(ev).toBeDefined()
    expect(ev?.taskId).toBe(taskId)
    expect(ev?.runId).toBe('run-1')
    expect(ev?.ownerId).toBe('alice')
    expect(ev?.prevTaskId).toBeNull()
    expect(ev?.dept).toBe('ops')
    expect(ev?.type).toBe('task.created')
  })

  it('duplicate eventId is idempotent: no second message is produced', async () => {
    const eventId = `ev-idem-${TS}`
    const first = await store.publishLineageEvent({
      eventId,
      type: 'task.created',
      taskId: `t-idem-${TS}`,
      ownerId: 'bob',
    })
    expect(first.ok && !first.duplicate).toBe(true)
    const countAfterFirst = await store.countLineageEvents()

    const second = await store.publishLineageEvent({
      eventId,
      type: 'task.created',
      taskId: `t-idem-${TS}`,
      ownerId: 'bob',
    })
    expect(second.ok).toBe(true)
    if (second.ok) expect(second.duplicate).toBe(true)

    expect(await store.countLineageEvents()).toBe(countAfterFirst)
  })

  // ── store layer: consumer group consume → ack → no message loss ───────

  it('after the consumer group consumes and acks, pending drops to zero (no message loss)', async () => {
    await store.publishLineageEvent({
      eventId: `ev-consume-${TS}`,
      type: 'task.created',
      taskId: `t-consume-${TS}`,
      ownerId: 'carol',
    })

    const events = await store.consumeLineageEvents(50, 'test-consumer')
    expect(events.some((e) => e.eventId === `ev-consume-${TS}`)).toBe(true)

    await store.ackLineageEvents(events.map((e) => e.streamId))
    const pending = await store.getPendingLineageCount()
    expect(pending).toBe(0)
  })

  it('unacked messages can be claimed by a recovery consumer via XPENDING+XCLAIM (crash recovery, Redis 5 compatible)', async () => {
    await store.publishLineageEvent({
      eventId: `ev-crash-${TS}`,
      type: 'task.moved',
      taskId: `t-crash-${TS}`,
      ownerId: 'dave',
      payload: { from: 'backlog', column: 'doing' },
    })

    // Crashed consumer: reads but never acks → message goes to pending
    const read = await store.consumeLineageEvents(50, 'crashed-consumer')
    expect(read.some((e) => e.eventId === `ev-crash-${TS}`)).toBe(true)
    const pendingBefore = await store.getPendingLineageCount()
    expect(pendingBefore).toBeGreaterThan(0)

    // Recovery consumer claims immediately with minIdleMs=0 (XPENDING filter + XCLAIM, works on Redis 5)
    const claimed = await store.claimStaleLineageEvents(0, 10, 'recovery-consumer')
    expect(claimed.some((e) => e.eventId === `ev-crash-${TS}`)).toBe(true)

    await store.ackLineageEvents(claimed.map((e) => e.streamId))
    expect(await store.getPendingLineageCount()).toBe(0)
  })

  // ── store layer: replay does not change consumption state ─────────────

  it('XRANGE replay returns events without changing the pending count', async () => {
    const taskId = `t-replay-${TS}`
    await store.publishLineageEvent({
      eventId: `ev-replay-${TS}`,
      type: 'task.updated',
      taskId,
      ownerId: 'erin',
      payload: { updates: { priority: 'high' } },
    })

    const pendingBefore = await store.getPendingLineageCount()
    const events = await store.replayLineageEvents('-', 100)
    expect(events.some((e) => e.eventId === `ev-replay-${TS}`)).toBe(true)
    expect(await store.getPendingLineageCount()).toBe(pendingBefore)
  })

  // ── store layer: lineage chain (prevTaskId ancestors + successors) ────

  it('lineage chain: trace ancestors via prevTaskId and list direct child tasks', async () => {
    const rootTask = `t-root-${TS}`
    const childTask = `t-child-${TS}`
    const grandTask = `t-grand-${TS}`

    await store.publishLineageEvent({
      eventId: `ev-root-${TS}`,
      type: 'task.created',
      taskId: rootTask,
      ownerId: 'alice',
      dept: 'ops',
    })
    await store.publishLineageEvent({
      eventId: `ev-child-${TS}`,
      type: 'task.created',
      taskId: childTask,
      ownerId: 'bob',
      prevTaskId: rootTask,
      dept: 'sales',
    })
    await store.publishLineageEvent({
      eventId: `ev-grand-${TS}`,
      type: 'task.created',
      taskId: grandTask,
      ownerId: 'bob',
      prevTaskId: childTask,
      dept: 'sales',
    })

    // Grandchild chain: ancestors = [root, child, grand]
    const grandChain = await store.getLineageChain(grandTask)
    expect(grandChain).not.toBeNull()
    expect(grandChain?.ancestors.map((n) => n.taskId)).toEqual([
      rootTask,
      childTask,
      grandTask,
    ])
    expect(grandChain?.node?.taskId).toBe(grandTask)
    expect(grandChain?.children).toEqual([])
    // Ancestor chain fields are complete
    const root = grandChain?.ancestors[0]
    expect(root?.ownerId).toBe('alice')
    expect(root?.dept).toBe('ops')
    expect(root?.prevTaskId).toBeNull()
    expect(root?.ts).toBeGreaterThan(0)

    // Root task: successors = [child]
    const rootChain = await store.getLineageChain(rootTask)
    expect(rootChain?.children.map((n) => n.taskId)).toEqual([childTask])
    expect(rootChain?.ancestors.map((n) => n.taskId)).toEqual([rootTask])

    // Unknown task → null
    expect(await store.getLineageChain(`t-missing-${TS}`)).toBeNull()
  })

  // ── API layer: POST /api/lineage ──────────────────────────────────────

  it('anonymous lineage event write → 401', async () => {
    const { body } = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(null, {
          method: 'POST',
          path: '/api/lineage',
          body: JSON.stringify({ type: 'task.created', taskId: 't-anon' }),
        }),
      ),
      401,
    )
    expect(String(body.ok)).toBe('false')
  })

  it('authenticated user write → 201, owner defaults to the current user', async () => {
    const taskId = `t-api-${TS}`
    const { body } = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(adminToken, {
          method: 'POST',
          path: '/api/lineage',
          body: JSON.stringify({ type: 'task.created', taskId }),
        }),
      ),
      201,
    )
    expect(body.ok).toBe(true)
    const event = body.event as Record<string, unknown>
    expect(event.taskId).toBe(taskId)
    expect(event.ownerId).toBe(adminId)
  })

  it('duplicate eventId → 200 idempotent success (duplicate:true)', async () => {
    const taskId = `t-api-idem-${TS}`
    const payload = JSON.stringify({
      eventId: `ev-api-idem-${TS}`,
      type: 'task.created',
      taskId,
    })
    const first = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(adminToken, {
          method: 'POST',
          path: '/api/lineage',
          body: payload,
        }),
      ),
      201,
    )
    expect(first.body.ok).toBe(true)
    const second = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(adminToken, {
          method: 'POST',
          path: '/api/lineage',
          body: payload,
        }),
      ),
      200,
    )
    expect(second.body.ok).toBe(true)
    expect(second.body.duplicate).toBe(true)
  })

  it('invalid type / missing taskId → 400', async () => {
    const bad = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(adminToken, {
          method: 'POST',
          path: '/api/lineage',
          body: JSON.stringify({ type: 'bogus.type', taskId: 't-bad' }),
        }),
      ),
      400,
    )
    expect(String(bad.body.ok)).toBe('false')

    const missing = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'POST',
        makeContractRequest(adminToken, {
          method: 'POST',
          path: '/api/lineage',
          body: JSON.stringify({ type: 'task.created' }),
        }),
      ),
      400,
    )
    expect(String(missing.body.ok)).toBe('false')
  })

  // ── API layer: GET /api/lineage?taskId= ───────────────────────────────

  it('lineage chain query: data 200, unknown task 404, missing param 400', async () => {
    const taskId = `t-api-chain-${TS}`
    const subTask = `t-api-chain-sub-${TS}`
    await store.publishLineageEvent({
      eventId: `ev-api-chain-${TS}`,
      type: 'task.created',
      taskId,
      ownerId: 'alice',
    })
    await store.publishLineageEvent({
      eventId: `ev-api-chain-sub-${TS}`,
      type: 'task.created',
      taskId: subTask,
      ownerId: 'bob',
      prevTaskId: taskId,
    })

    const ok = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'GET',
        makeContractRequest(adminToken, { path: `/api/lineage?taskId=${subTask}` }),
      ),
      200,
    )
    expect(ok.body.ok).toBe(true)
    const chain = ok.body.chain as { ancestors: Array<{ taskId: string }> }
    expect(chain.ancestors.map((n) => n.taskId)).toEqual([taskId, subTask])

    const missing = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'GET',
        makeContractRequest(adminToken, {
          path: `/api/lineage?taskId=no-such-${TS}`,
        }),
      ),
      404,
    )
    expect(String(missing.body.ok)).toBe('false')

    const noParam = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage',
        'GET',
        makeContractRequest(adminToken, { path: '/api/lineage' }),
      ),
      400,
    )
    expect(String(noParam.body.ok)).toBe('false')
  })

  // ── API layer: GET /api/lineage/events (replay, super_admin only) ─────

  it('replay endpoint: anonymous 401 / regular user 403 / super admin 200', async () => {
    const anon = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.events',
        'GET',
        makeContractRequest(null, { path: '/api/lineage/events' }),
      ),
      401,
    )
    expect(String(anon.body.ok)).toBe('false')

    const regular = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.events',
        'GET',
        makeContractRequest(regularToken, { path: '/api/lineage/events' }),
      ),
      403,
    )
    expect(String(regular.body.ok)).toBe('false')

    const ok = await expectJsonStatus(
      await invokeRouteHandler(
        '@/routes/api/lineage.events',
        'GET',
        makeContractRequest(adminToken, { path: '/api/lineage/events' }),
      ),
      200,
    )
    expect(ok.body.ok).toBe(true)
    const events = ok.body.events as Array<{ eventId: string }>
    expect(events.length).toBeGreaterThan(0)
    expect(events.some((e) => e.eventId === `ev-root-${TS}`)).toBe(true)
  })
})
