import { describe, expect, it, vi } from 'vitest'

import {
  canAccessLocalSession,
  ensureLocalSession,
  getLocalSessionOwner,
  listLocalSessions,
} from '@/server/local-session-store'

// Pure in-memory path tests: Redis is mocked to verify data-level isolation in multi-user mode (ownerId ownership filtering).
vi.mock('@/server/redis-client', () => ({
  getRedisClient: () => Promise.resolve(null),
  getRedisClientSync: () => null,
}))

const uid = () => `session-${Math.random().toString(36).slice(2, 10)}`

describe('local-session owner isolation (G2)', () => {
  it('ensureLocalSession stamps ownerId on creation', () => {
    const id = uid()
    const session = ensureLocalSession(id, undefined, 'alice')
    expect(session.ownerId).toBe('alice')
    expect(getLocalSessionOwner(id)).toBe('alice')
  })

  it('ensureLocalSession without owner leaves session unowned', () => {
    const id = uid()
    const session = ensureLocalSession(id)
    expect(session.ownerId).toBeUndefined()
    expect(getLocalSessionOwner(id)).toBeUndefined()
  })

  it('ensureLocalSession keeps original owner when session already exists', () => {
    const id = uid()
    ensureLocalSession(id, undefined, 'alice')
    // A second call does not overwrite ownership even with a different owner (ownership is fixed once established)
    const session = ensureLocalSession(id, undefined, 'bob')
    expect(session.ownerId).toBe('alice')
  })

  it('listLocalSessions filters by owner in multi-user mode', () => {
    const aliceId = uid()
    const bobId = uid()
    ensureLocalSession(aliceId, undefined, 'alice')
    ensureLocalSession(bobId, undefined, 'bob')

    const aliceSessions = listLocalSessions('alice')
    expect(aliceSessions.map((s) => s.id)).toContain(aliceId)
    expect(aliceSessions.map((s) => s.id)).not.toContain(bobId)

    const bobSessions = listLocalSessions('bob')
    expect(bobSessions.map((s) => s.id)).toContain(bobId)
    expect(bobSessions.map((s) => s.id)).not.toContain(aliceId)
  })

  it('listLocalSessions without owner returns everything (single-user mode)', () => {
    const id = uid()
    ensureLocalSession(id, undefined, 'alice')
    const all = listLocalSessions()
    expect(all.some((s) => s.id === id)).toBe(true)
  })

  it('unowned legacy sessions are excluded from owner-filtered lists', () => {
    const legacyId = uid()
    ensureLocalSession(legacyId)
    const ownerSessions = listLocalSessions('alice')
    expect(ownerSessions.some((s) => s.id === legacyId)).toBe(false)
  })

  it('canAccessLocalSession allows only the owner in multi-user mode', () => {
    const id = uid()
    ensureLocalSession(id, undefined, 'alice')
    expect(canAccessLocalSession(id, 'alice')).toBe(true)
    expect(canAccessLocalSession(id, 'bob')).toBe(false)
  })

  it('canAccessLocalSession denies unowned sessions in multi-user mode', () => {
    const id = uid()
    ensureLocalSession(id)
    expect(canAccessLocalSession(id, 'alice')).toBe(false)
  })

  it('canAccessLocalSession always allows without owner (single-user mode)', () => {
    const id = uid()
    ensureLocalSession(id, undefined, 'alice')
    expect(canAccessLocalSession(id, undefined)).toBe(true)
    expect(canAccessLocalSession(id, '')).toBe(true)
  })
})
