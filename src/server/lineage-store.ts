/**
 * G3 lineage communication layer — Redis Streams event bus.
 *
 * Event model contract: task / run / owner / prev_task / ts / dept
 *  - taskId: task ID (lineage subject)
 *  - runId: run ID (one session / one agent execution)
 *  - ownerId: owning user (who created/executed)
 *  - prevTaskId: lineage predecessor task (forms lineage chains on cross-department task flow)
 *  - dept: department/team identifier
 *  - ts: event timestamp (ms)
 *
 * Reliability design (native Redis Streams capabilities, already in ioredis, no new library):
 *  - Write: XADD to the main event stream; idempotency via SETNX dedup key (duplicate eventId skipped)
 *  - Consume: XREADGROUP consumer-group reads (no ack); caller XACKs after successful processing
 *  - Recovery: XPENDING + XCLAIM claim timed-out pending messages (Redis 5 compatible, no XAUTOCLAIM)
 *  - Replay: XRANGE direct read (bypasses the consumer group, for audit/backfill)
 *  - Lineage chain: per-task latest-event Hash snapshot + child-task reverse index, backtracking
 *    the ancestor chain along prevTaskId
 *
 * When Redis is unavailable, everything degrades gracefully (returns null / empty arrays),
 * not affecting deployments without Redis.
 * Test isolation: the key prefix can be overridden with TI_WORK_LINEAGE_PREFIX
 * (default hermes:studio:lineage).
 */
import { randomUUID } from 'node:crypto'
import { getRedisClientSync } from './redis-client'

export type LineageEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.moved'
  | 'task.deleted'
  | 'run.started'
  | 'run.completed'
  | 'run.error'

export interface LineageEventInput {
  /** Globally unique event ID; auto-generated when omitted (idempotency key) */
  eventId?: string
  type: LineageEventType | string
  taskId: string
  runId?: string
  /** Owning user (who created/executed) */
  ownerId: string
  /** Lineage predecessor task ID; passed in by the business layer on cross-department task flow */
  prevTaskId?: string | null
  /** Department/team identifier */
  dept?: string | null
  /** Additional payload (title, stage transitions, etc.) */
  payload?: Record<string, unknown>
}

export interface LineageEvent extends LineageEventInput {
  eventId: string
  /** Event timestamp (ms) */
  ts: number
  /** Redis Stream message ID (for XACK) */
  streamId: string
}

/** publish result: duplicate=true means the eventId was already written (idempotent skip) */
export type LineagePublishResult =
  | { ok: true; duplicate: false; event: LineageEvent }
  | { ok: true; duplicate: true; event: null }
  | { ok: false; event: null }

/** Lineage event publish hook (for the G8 enterprise hub forwarder): synchronous callback after a successful local publish */
export type LineagePublishedListener = (event: LineageEvent) => void

const publishedListeners: Array<LineagePublishedListener> = []

/** Register a publish-success listener; returns an unregister function. With no listeners by default → zero overhead, existing tests unaffected */
export function onLineagePublished(listener: LineagePublishedListener): () => void {
  publishedListeners.push(listener)
  return () => {
    const idx = publishedListeners.indexOf(listener)
    if (idx !== -1) publishedListeners.splice(idx, 1)
  }
}

export interface LineageChainNode {
  taskId: string
  type: string
  ownerId: string
  prevTaskId: string | null
  dept: string | null
  runId?: string
  ts: number
  payload?: Record<string, unknown>
}

export interface LineageChain {
  /** Current task node */
  node: LineageChainNode | null
  /** Ancestor chain (backtracking from the current task along prevTaskId to the root, including the current node) */
  ancestors: Array<LineageChainNode>
  /** Direct successor subtasks (lineage flow direction) */
  children: Array<LineageChainNode>
}

const DEFAULT_PREFIX = 'hermes:studio:lineage'
const GROUP_NAME = 'audit'
const DEDUP_TTL_SECONDS = 3600

function prefix(): string {
  return process.env.TI_WORK_LINEAGE_PREFIX ?? DEFAULT_PREFIX
}
const streamKey = () => `${prefix()}:events`
const groupName = () => `${prefix()}:${GROUP_NAME}`
const dedupKey = (eventId: string) => `${prefix()}:dedup:${eventId}`
const nodeKey = (taskId: string) => `${prefix()}:node:${taskId}`
const nodesSetKey = () => `${prefix()}:nodes`
const childrenKey = (taskId: string) => `${prefix()}:children:${taskId}`

function parseEvent(streamId: string, raw: Array<string>): LineageEvent | null {
  if (raw.length < 2) return null
  const idx = raw.indexOf('e')
  if (idx === -1 || !raw[idx + 1]) return null
  try {
    const event = JSON.parse(raw[idx + 1]) as LineageEvent
    event.streamId = streamId
    return event
  } catch {
    return null
  }
}

function parseNode(raw: string | null): LineageChainNode | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as LineageChainNode
  } catch {
    return null
  }
}

/**
 * Write a lineage event (XADD, idempotent).
 *  - { ok:true, duplicate:false } first successful write
 *  - { ok:true, duplicate:true }  eventId already written, idempotent skip
 *  - { ok:false }                 Redis unavailable or write failed
 */
export async function publishLineageEvent(
  input: LineageEventInput,
): Promise<LineagePublishResult> {
  const client = getRedisClientSync()
  if (!client) return { ok: false, event: null }

  const event: LineageEvent = {
    ...input,
    eventId: input.eventId ?? randomUUID(),
    prevTaskId: input.prevTaskId ?? null,
    dept: input.dept ?? null,
    ts: Date.now(),
    streamId: '',
  }

  // Idempotency gate: skip if the eventId was already written (SETNX)
  const claimed = await client.set(
    dedupKey(event.eventId),
    '1',
    'EX',
    DEDUP_TTL_SECONDS,
    'NX',
  )
  if (claimed !== 'OK') return { ok: true, duplicate: true, event: null }

  const payloadJson = JSON.stringify({
    eventId: event.eventId,
    type: event.type,
    taskId: event.taskId,
    runId: event.runId,
    ownerId: event.ownerId,
    prevTaskId: event.prevTaskId,
    dept: event.dept,
    ts: event.ts,
    payload: event.payload ?? null,
  })

  try {
    const multi = client.multi()
    multi.xadd(streamKey(), '*', 'e', payloadJson)
    multi.hset(nodeKey(event.taskId), 'e', payloadJson)
    multi.sadd(nodesSetKey(), event.taskId)
    if (event.prevTaskId) multi.sadd(childrenKey(event.prevTaskId), event.taskId)
    const results = await multi.exec()
    const streamId = results?.[0]?.[1] as string | undefined
    if (!streamId) {
      // Write anomaly: release the idempotency key to allow retry
      await client.del(dedupKey(event.eventId))
      return { ok: false, event: null }
    }
    event.streamId = streamId
    if (publishedListeners.length > 0) {
      // Notify listeners synchronously after a successful publish (enterprise hub forwarding
      // hook); a listener exception must not affect the main flow
      for (const listener of publishedListeners) {
        try {
          listener(event)
        } catch {
          // Ignore forwarding exceptions (the local lineage write already succeeded)
        }
      }
    }
    return { ok: true, duplicate: false, event }
  } catch {
    await client.del(dedupKey(event.eventId)).catch(() => {})
    return { ok: false, event: null }
  }
}

/** Ensure the consumer group exists (XGROUP CREATE MKSTREAM; ignored when already present) */
export async function ensureLineageGroup(): Promise<void> {
  const client = getRedisClientSync()
  if (!client) return
  try {
    await client.xgroup('CREATE', streamKey(), groupName(), '0', 'MKSTREAM')
  } catch (err) {
    // BUSYGROUP is normal (group already exists)
    const msg = err instanceof Error ? err.message : String(err)
    if (!/BUSYGROUP/i.test(msg)) throw err
  }
}

/**
 * Read undelivered messages from the consumer group (XREADGROUP '>', no ack).
 * The caller must ackLineageEvents after successful processing, otherwise messages stay
 * in pending for recovery.
 */
export async function consumeLineageEvents(
  count = 10,
  consumerName = 'server',
): Promise<Array<LineageEvent>> {
  const client = getRedisClientSync()
  if (!client) return []
  await ensureLineageGroup()
  // ioredis types say the return is non-null, but at runtime it is null when there are no
  // messages, so check explicitly
  const raw = (await client.xreadgroup(
    'GROUP',
    groupName(),
    consumerName,
    'COUNT',
    count,
    'STREAMS',
    streamKey(),
    '>',
  )) as unknown
  if (raw == null) return []
  const res = raw as Array<[string, Array<[string, Array<string>]>]>
  const events: Array<LineageEvent> = []
  for (const [, messages] of res) {
    for (const [id, fields] of messages) {
      const event = parseEvent(id, fields)
      if (event) events.push(event)
    }
  }
  return events
}

/** Acknowledge consumption (XACK); nonexistent IDs are silently ignored */
export async function ackLineageEvents(streamIds: Array<string>): Promise<void> {
  const client = getRedisClientSync()
  if (!client || streamIds.length === 0) return
  await ensureLineageGroup()
  await client.xack(streamKey(), groupName(), ...streamIds)
}

/**
 * Claim pending messages that timed out without ack (XPENDING + XCLAIM, Redis 5 compatible).
 * Messages stay in pending when they were delivered via XREADGROUP but the business processing
 * crashed before acking; once idle past minIdleMs, XCLAIM hands them to this consumer for
 * retry, implementing "no message loss".
 */
export async function claimStaleLineageEvents(
  minIdleMs = 30_000,
  count = 10,
  consumerName = 'recovery',
): Promise<Array<LineageEvent>> {
  const client = getRedisClientSync()
  if (!client) return []
  await ensureLineageGroup()
  const summary = (await client.xpending(
    streamKey(),
    groupName(),
    '-',
    '+',
    count * 10,
  )) as Array<[string, string, string, string]> | null
  if (!summary || summary.length === 0) return []

  const staleIds: Array<string> = []
  for (const [id, , idleMs] of summary) {
    if (Number(idleMs) >= minIdleMs) staleIds.push(id)
    if (staleIds.length >= count) break
  }
  if (staleIds.length === 0) return []

  const claimed = (await client.xclaim(
    streamKey(),
    groupName(),
    consumerName,
    minIdleMs,
    ...staleIds,
  )) as Array<[string, Array<string>]> | null
  if (!claimed) return []

  const events: Array<LineageEvent> = []
  for (const [id, fields] of claimed) {
    const event = parseEvent(id, fields)
    if (event) events.push(event)
  }
  return events
}

/** Number of pending unacknowledged messages (XPENDING summary) */
export async function getPendingLineageCount(): Promise<number> {
  const client = getRedisClientSync()
  if (!client) return 0
  try {
    const summary = (await client.xpending(streamKey(), groupName())) as
      | Array<unknown>
      | null
    if (!summary || summary.length === 0) return 0
    return Number(summary[0] ?? 0)
  } catch {
    // XPENDING errors when the group does not exist; treat as 0
    return 0
  }
}

/**
 * Replay lineage events (XRANGE direct read; bypasses the consumer group and does not change
 * consumption state).
 * fromId: starting message ID ('0' means the beginning; the '-' default already covers the
 * full range).
 */
export async function replayLineageEvents(
  fromId = '-',
  count = 100,
): Promise<Array<LineageEvent>> {
  const client = getRedisClientSync()
  if (!client) return []
  const res = (await client.xrange(
    streamKey(),
    fromId,
    '+',
    'COUNT',
    count,
  )) as Array<[string, Array<string>]> | null
  if (!res) return []
  const events: Array<LineageEvent> = []
  for (const [id, fields] of res) {
    const event = parseEvent(id, fields)
    if (event) events.push(event)
  }
  return events
}

/** Total number of lineage events (XLEN) */
export async function countLineageEvents(): Promise<number> {
  const client = getRedisClientSync()
  if (!client) return 0
  try {
    return await client.xlen(streamKey())
  } catch {
    return 0
  }
}

/**
 * Lineage chain query: backtrack the ancestor chain from taskId along prevTaskId, and list
 * direct successor subtasks.
 */
export async function getLineageChain(
  taskId: string,
): Promise<LineageChain | null> {
  const client = getRedisClientSync()
  if (!client) return null

  const current = parseNode(await client.hget(nodeKey(taskId), 'e'))
  if (!current) return null

  // Ancestor chain: backtrack along prevTaskId
  const ancestors: Array<LineageChainNode> = [current]
  const seen = new Set<string>([taskId])
  let cursor: string | null = current.prevTaskId
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor)
    const node = parseNode(await client.hget(nodeKey(cursor), 'e'))
    if (!node) break
    ancestors.unshift(node)
    cursor = node.prevTaskId
  }

  // Direct successors (lineage flow direction)
  const childIds = await client.smembers(childrenKey(taskId))
  const children: Array<LineageChainNode> = []
  for (const childId of childIds) {
    const node = parseNode(await client.hget(nodeKey(childId), 'e'))
    if (node) children.push(node)
  }
  children.sort((a, b) => a.ts - b.ts)

  return { node: current, ancestors, children }
}

/** Set of lineage tasks (for cockpit/audit enumeration) */
export async function listLineageTaskIds(): Promise<Array<string>> {
  const client = getRedisClientSync()
  if (!client) return []
  return client.smembers(nodesSetKey())
}
