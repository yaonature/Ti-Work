/**
 * G2 contract tests — identity core (identity.ts, real Redis).
 *
 * Verifies the red line: passwords are stored as bcrypt hashes (no plaintext in Redis);
 * register/authenticate/role assignment are fully persisted for real; duplicate creation
 * and accidental deletion both have explicit contracts.
 *
 * The Redis contract suite is skipped entirely when TI_WORK_TEST_REDIS_URL is not set (provided by CI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createContractAuthHarness,
  deleteIdentityUser,
  identityUserKey,
  IDENTITY_USERS_KEY,
  readStoredIdentityUser,
} from './harness/contract-harness'
import { getTestRedisUrl } from './harness/redis-harness'

const redisUrl = getTestRedisUrl()

describe.skipIf(!redisUrl)('Identity core contract (real Redis + bcrypt)', () => {
  let identity: typeof import('@/server/identity')
  let harness: Awaited<ReturnType<typeof createContractAuthHarness>>

  const ts = Date.now()
  const created: Array<string> = []

  function rememberUser(userId: string): void {
    created.push(userId)
    harness.trackUser(userId)
  }

  async function cleanupUser(userId: string): Promise<void> {
    await deleteIdentityUser(harness.redis, userId)
  }

  beforeAll(async () => {
    harness = await createContractAuthHarness({
      redisUrl: redisUrl!,
    })
    identity = harness.identity
  })

  afterAll(async () => {
    for (const userId of created) {
      await cleanupUser(userId)
    }
    await harness.cleanup()
  })

  it('createUser persists to Redis: password is a bcrypt hash, not plaintext', async () => {
    const id = `alice-${ts}`
    rememberUser(id)

    await identity.createUser({
      userId: id,
      displayName: 'Alice',
      password: 'alice-secret-1',
      role: 'regular_admin',
    })

    const stored = await readStoredIdentityUser(harness.redis, id)
    expect(stored).not.toBeNull()
    if (!stored) throw new Error('stored user missing after createUser')
    expect(stored.userId).toBe(id)
    expect(stored.role).toBe('regular_admin')
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/)
    expect(String(stored.passwordHash)).not.toContain('alice-secret-1')
  })

  it('creating the same user twice throws without overwriting the original record', async () => {
    const id = `dup-${ts}`
    rememberUser(id)

    await identity.createUser({ userId: id, password: 'first-pass' })
    await expect(
      identity.createUser({ userId: id, password: 'second-pass' }),
    ).rejects.toThrow(/already exists/i)

    // The original password still authenticates, proving it was not overwritten
    const user = await identity.authenticateUser(id, 'first-pass')
    expect(user).not.toBeNull()
  })

  it('authenticateUser: correct password passes, wrong password is rejected, unknown user returns null', async () => {
    const id = `bob-${ts}`
    rememberUser(id)
    await identity.createUser({ userId: id, password: 'bob-secret' })

    const ok = await identity.authenticateUser(id, 'bob-secret')
    expect(ok?.userId).toBe(id)

    const bad = await identity.authenticateUser(id, 'wrong-password')
    expect(bad).toBeNull()

    const ghost = await identity.authenticateUser(`ghost-${ts}`, 'anything')
    expect(ghost).toBeNull()
  })

  it('updateUserRole takes effect and syncs to Redis', async () => {
    const id = `carol-${ts}`
    rememberUser(id)
    await identity.createUser({ userId: id, password: 'carol-secret' })

    const updated = await identity.updateUserRole(id, 'super_admin')
    expect(updated?.role).toBe('super_admin')

    const stored = await readStoredIdentityUser(harness.redis, id)
    if (!stored) throw new Error('stored user missing after updateUserRole')
    expect(stored.role).toBe('super_admin')
  })

  it('updateUserPassword: old password invalidated, new password works', async () => {
    const id = `dave-${ts}`
    rememberUser(id)
    await identity.createUser({ userId: id, password: 'old-pass' })

    const ok = await identity.updateUserPassword(id, 'new-pass')
    expect(ok).toBe(true)

    await expect(identity.authenticateUser(id, 'old-pass')).resolves.toBeNull()
    const fresh = await identity.authenticateUser(id, 'new-pass')
    expect(fresh?.userId).toBe(id)
  })

  it('updateUserPassword returns false for a nonexistent user', async () => {
    await expect(
      identity.updateUserPassword(`nobody-${ts}`, 'x'),
    ).resolves.toBe(false)
  })

  it('deleteUser removes both in-memory and Redis records', async () => {
    const id = `erin-${ts}`
    rememberUser(id)
    await identity.createUser({ userId: id, password: 'erin-secret' })

    const removed = await identity.deleteUser(id)
    expect(removed).toBe(true)

    expect(identity.userExists(id)).toBe(false)
    expect(await harness.redis.get(identityUserKey(id))).toBeNull()
    expect(await harness.redis.sismember(IDENTITY_USERS_KEY, id)).toBe(0)

    // Second delete returns false
    await expect(identity.deleteUser(id)).resolves.toBe(false)
  })

  it('listUsers exposes only sanitized fields, no passwordHash', async () => {
    const id = `frank-${ts}`
    rememberUser(id)
    await identity.createUser({ userId: id, password: 'frank-secret' })

    const users = identity.listUsers()
    const target = users.find((u) => u.userId === id)
    expect(target).toBeDefined()
    expect(target).not.toHaveProperty('passwordHash')

    const serialized = JSON.stringify(users)
    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('frank-secret')
  })

  it('ensureSeedAdmin: does nothing when no admin password is configured', async () => {
    delete process.env.TI_WORK_ADMIN_PASSWORD
    await expect(identity.ensureSeedAdmin()).resolves.toBe(false)
  })

  it('ensureSeedAdmin: does not reseed when users already exist (idempotent)', async () => {
    process.env.TI_WORK_ADMIN_PASSWORD = 'seed-pw'
    process.env.TI_WORK_ADMIN_USER = 'seed-admin'
    try {
      // Users already exist in the system (created by this file); seeding must be refused
      await expect(identity.ensureSeedAdmin()).resolves.toBe(false)
    } finally {
      delete process.env.TI_WORK_ADMIN_PASSWORD
      delete process.env.TI_WORK_ADMIN_USER
    }
  })

  it('ensureSeedAdmin: seeds super_admin when the user table is empty (only when Redis is clean)', async () => {
    // Remove all users created by this file
    for (const userId of created) {
      await cleanupUser(userId)
    }
    created.length = 0
    harness.createdUserIds.length = 0

    const existing = await harness.redis.scard(IDENTITY_USERS_KEY)
    if (existing > 0) {
      // Other parallel test files left users in the shared Redis: this branch cannot be verified in isolation
      return
    }

    process.env.TI_WORK_MULTIUSER = '1'
    process.env.TI_WORK_ADMIN_PASSWORD = 'bootstrap-pw'
    process.env.TI_WORK_ADMIN_USER = 'bootstrap-admin'
    try {
      const seeded = await identity.ensureSeedAdmin()
      expect(seeded).toBe(true)

      const admin = identity.getUser('bootstrap-admin')
      expect(admin?.role).toBe('super_admin')

      // Seeding again returns false (idempotent)
      await expect(identity.ensureSeedAdmin()).resolves.toBe(false)
    } finally {
      await cleanupUser('bootstrap-admin')
      delete process.env.TI_WORK_MULTIUSER
      delete process.env.TI_WORK_ADMIN_PASSWORD
      delete process.env.TI_WORK_ADMIN_USER
    }
  })
})
