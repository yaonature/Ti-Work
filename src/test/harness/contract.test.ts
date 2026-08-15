/**
 * G0 contract tests — verify the integration test harness itself works and is real:
 *  1. SQLite: real better-sqlite3 on-disk files, create table / insert / read back / cleanup
 *  2. Redis Streams: XADD → XREADGROUP → XACK → XAUTOCLAIM recovery chain on real Redis,
 *     exactly the primitives the G3 lineage communication layer depends on
 *
 * Red line: business-logic tests never mock; they all use real dependencies.
 * The Redis contract suite is skipped entirely when TI_WORK_TEST_REDIS_URL is not set (provided by CI).
 */
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createSqliteHarness } from './sqlite-harness'
import {
  createRedisHarness,
  getTestRedisUrl,
  harnessPrefix,
} from './redis-harness'

describe('SQLite harness (real dependency)', () => {
  it('create table → insert → read back: data is really on disk with complete fields', () => {
    const harness = createSqliteHarness()
    try {
      harness.db.exec(
        `CREATE TABLE lineage_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_key TEXT NOT NULL,
          run_id TEXT,
          event TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      )
      const insert = harness.db.prepare(
        'INSERT INTO lineage_events (session_key, run_id, event, payload) VALUES (?, ?, ?, ?)',
      )
      const info = insert.run('sess-1', 'run-1', 'task.created', '{"owner":"alice"}')
      expect(info.changes).toBe(1)

      const row = harness.db
        .prepare('SELECT * FROM lineage_events WHERE id = ?')
        .get(info.lastInsertRowid) as Record<string, unknown>
      expect(row.session_key).toBe('sess-1')
      expect(row.run_id).toBe('run-1')
      expect(row.event).toBe('task.created')
      expect(row.payload).toBe('{"owner":"alice"}')
      expect(typeof row.created_at).toBe('string')
      expect((row.created_at as string).length).toBeGreaterThan(0)
    } finally {
      harness.cleanup()
    }
  })

  it('after cleanup the temp directory is removed with no leftover test files', () => {
    const harness = createSqliteHarness()
    const dir = harness.dir
    harness.cleanup()
    expect(existsSync(dir)).toBe(false)
  })

  it('multiple instances do not pollute each other: each persists independently', () => {
    const a = createSqliteHarness()
    const b = createSqliteHarness()
    try {
      a.db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
      a.db.prepare('INSERT INTO t (v) VALUES (?)').run('a-value')

      // b's database is a fresh file; a's table must not exist there
      expect(() => b.db.prepare('SELECT * FROM t').get()).toThrow()
    } finally {
      a.cleanup()
      b.cleanup()
    }
  })
})

const redisUrl = getTestRedisUrl()

/** XAUTOCLAIM requires Redis 6.2+; older servers return null from COMMAND INFO. */
let _supportsXautoclaim: boolean | null = null
async function supportsXautoclaim(): Promise<boolean> {
  if (_supportsXautoclaim !== null) return _supportsXautoclaim
  const redis = await createRedisHarness(redisUrl!)
  try {
    const info = await redis.call('COMMAND', 'INFO', 'xautoclaim')
    _supportsXautoclaim =
      Array.isArray(info) && info.length > 0 && info[0] !== null
    return _supportsXautoclaim
  } finally {
    await redis.quit()
  }
}

describe.skipIf(!redisUrl)(
  'Redis Streams harness (real dependency, TI_WORK_TEST_REDIS_URL)',
  () => {
    it('full XADD → XREADGROUP → XACK chain: no message loss, pending reaches zero after ack', async () => {
      const redis = await createRedisHarness(redisUrl!)
      const stream = harnessPrefix(`stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      const group = harnessPrefix(`group-${Date.now()}`)
      try {
        await redis.xadd(stream, '*', 'task', 't1', 'owner', 'alice', 'ts', '1000')
        await redis.xadd(stream, '*', 'task', 't2', 'owner', 'bob', 'ts', '2000')

        await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')
        const groupRead = await redis.xreadgroup(
          'GROUP', group, 'consumer-1', 'COUNT', '10', 'STREAMS', stream, '>',
        )

        // Both messages are delivered to the group in write order
        expect(groupRead).not.toBeNull()
        const groupMessages = groupRead as Array<
          [string, Array<[string, Array<string>]>]
        >
        const messages = groupMessages[0][1]
        expect(messages.length).toBe(2)
        expect(messages[0][1]).toContain('t1')
        expect(messages[1][1]).toContain('t2')

        for (const [id] of messages) {
          await redis.xack(stream, group, id)
        }
        const pending = await redis.xpending(stream, group)
        expect(pending[0]).toBe(0)
      } finally {
        await redis.del(stream)
        await redis.quit()
      }
    })

    it('unacked messages can be claimed by another consumer via XAUTOCLAIM (consumer group crash recovery)', async () => {
      // XAUTOCLAIM is a Redis 6.2+ primitive; older local servers (e.g. 5.0) don't support it, so skip legitimately
      if (!(await supportsXautoclaim())) {
        console.warn(
          '[harness] Redis server does not support XAUTOCLAIM (requires 6.2+), skipping this contract test',
        )
        return
      }
      const redis = await createRedisHarness(redisUrl!)
      const stream = harnessPrefix(`stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      const group = harnessPrefix(`group-${Date.now()}`)
      try {
        await redis.xadd(stream, '*', 'task', 't1', 'owner', 'alice')
        await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')

        // Crashed consumer: reads but never acks
        const read = await redis.xreadgroup(
          'GROUP', group, 'crashed-consumer', 'COUNT', '10', 'STREAMS', stream, '>',
        )
        expect(read).not.toBeNull()
        const readMessages = read as Array<
          [string, Array<[string, Array<string>]>]
        >
        const msgId = readMessages[0][1][0][0]

        const pendingBefore = await redis.xpending(stream, group)
        expect(pendingBefore[0]).toBe(1)

        // Recovery consumer claims immediately with min-idle=0
        const claimed = await redis.xautoclaim(
          stream, group, 'recovery-consumer', 0, '0-0', 'COUNT', '10',
        )
        const claimedMessages = claimed[1] as Array<[string, Array<string>]>
        expect(claimedMessages.length).toBe(1)
        expect(claimedMessages[0][0]).toBe(msgId)

        await redis.xack(stream, group, msgId)
        const pendingAfter = await redis.xpending(stream, group)
        expect(pendingAfter[0]).toBe(0)
      } finally {
        await redis.del(stream)
        await redis.quit()
      }
    })

    it('events persist in order; reads match writes exactly (lineage event ordering guarantee)', async () => {
      const redis = await createRedisHarness(redisUrl!)
      const stream = harnessPrefix(`stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      try {
        for (let i = 1; i <= 5; i++) {
          await redis.xadd(stream, '*', 'seq', String(i), 'task', `t${i}`)
        }
        const range = await redis.xrange(stream, '-', '+')
        expect(range.length).toBe(5)
        range.forEach(([id, fields], idx) => {
          expect(fields).toContain(`t${idx + 1}`)
          expect(id).toMatch(/^\d+-\d+$/)
        })
      } finally {
        await redis.del(stream)
        await redis.quit()
      }
    })
  },
)
