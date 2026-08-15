/**
 * G2 contract tests — user management API (real Redis).
 *
 * Coverage:
 *  - POST /api/auth/register   register (multi-user + self-registration toggle)
 *  - POST /api/auth/logout     logout (revokes token + clears cookie)
 *  - GET  /api/users           admin listing (sanitized)
 *  - POST /api/users           admin create (role assignable)
 *  - PATCH /api/users/:id      self password change / admin role change
 *  - DELETE /api/users/:id     admin delete (self-protection + last super-admin protection)
 *
 * The Redis contract suite is skipped entirely when TI_WORK_TEST_REDIS_URL is not set (provided by CI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createContractAuthHarness,
  expectJsonStatus,
  invokeRouteHandler,
  makeContractRequest,
  seedUser,
} from './harness/contract-harness'
import { getTestRedisUrl } from './harness/redis-harness'

const redisUrl = getTestRedisUrl()

describe.skipIf(!redisUrl)('User management API contract (real Redis)', () => {
  let identity: typeof import('@/server/identity')
  let auth: typeof import('@/server/auth-middleware')
  let harness: Awaited<ReturnType<typeof createContractAuthHarness>>

  const ts = Date.now()
  const adminId = `admin-${ts}`
  const regularId = `user-${ts}`
  const victimId = `victim-${ts}`
  let adminToken = ''
  let regularToken = ''

  beforeAll(async () => {
    harness = await createContractAuthHarness({
      redisUrl: redisUrl!,
      env: {
        TI_WORK_MULTIUSER: '1',
        TI_WORK_SELF_REGISTER: '1',
      },
      users: [
        seedUser(adminId, 'admin-pw-1', 'super_admin'),
        seedUser(regularId, 'regular-pw-1', 'regular_admin'),
        {
          userId: victimId,
          password: 'victim-pw-1',
          role: 'regular_admin',
          session: 'none',
        },
      ],
    })
    identity = harness.identity
    auth = harness.auth
    adminToken = harness.tokensByUserId[adminId]
    regularToken = harness.tokensByUserId[regularId]
  })

  afterAll(async () => {
    for (const id of [victimId, `reg-${ts}`, `created-${ts}`, `doomed-${ts}`]) {
      harness.trackUser(id)
    }
    await harness.cleanup()
  })

  describe('POST /api/auth/register', () => {
    const regUserId = `reg-${ts}`
    const regBody = JSON.stringify({
      userId: regUserId,
      password: 'register-pw-1',
    })

    it('non-multi-user mode → 403', async () => {
      delete process.env.TI_WORK_MULTIUSER
      try {
        const { body } = await expectJsonStatus(
          await invokeRouteHandler(
            '@/routes/api/auth.register',
            'POST',
            makeContractRequest(null, { method: 'POST', body: regBody }),
          ),
          403,
        )
        expect(String(body.ok)).toBe('false')
      } finally {
        process.env.TI_WORK_MULTIUSER = '1'
      }
    })

    it('multi-user with self-registration disabled → 403', async () => {
      delete process.env.TI_WORK_SELF_REGISTER
      try {
        await expectJsonStatus(
          await invokeRouteHandler(
            '@/routes/api/auth.register',
            'POST',
            makeContractRequest(null, { method: 'POST', body: regBody }),
          ),
          403,
        )
      } finally {
        process.env.TI_WORK_SELF_REGISTER = '1'
      }
    })

    it('valid registration → 201 with role regular_admin (least privilege)', async () => {
      const { body } = await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/auth.register',
          'POST',
          makeContractRequest(null, { method: 'POST', body: regBody }),
        ),
        201,
      )
      harness.trackUser(regUserId)
      const user = body.user as Record<string, unknown>
      expect(user.userId).toBe(regUserId)
      expect(user.role).toBe('regular_admin')
      expect(user).not.toHaveProperty('passwordHash')
    })

    it('duplicate registration → 409', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/auth.register',
          'POST',
          makeContractRequest(null, { method: 'POST', body: regBody }),
        ),
        409,
      )
    })

    it('invalid userId / weak password → 400', async () => {
      const badUserId = JSON.stringify({ userId: 'ab', password: 'long-enough-1' })
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/auth.register',
          'POST',
          makeContractRequest(null, { method: 'POST', body: badUserId }),
        ),
        400,
      )
      const weakPw = JSON.stringify({
        userId: `weak-${ts}`,
        password: 'short',
      })
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/auth.register',
          'POST',
          makeContractRequest(null, { method: 'POST', body: weakPw }),
        ),
        400,
      )
    })
  })

  describe('POST /api/auth/logout', () => {
    it('logout → 200, Set-Cookie cleared, token revoked', async () => {
      const token = auth.generateSessionToken()
      auth.storeSessionToken(token, regularId)
      harness.trackToken(token)
      expect(auth.isAuthenticated(makeContractRequest(token))).toBe(true)

      const res = (await invokeRouteHandler(
        '@/routes/api/auth.logout',
        'POST',
        makeContractRequest(token, { method: 'POST' }),
      )) as Response
      expect(res.status).toBe(200)
      const setCookie = res.headers.get('set-cookie') ?? ''
      expect(setCookie).toMatch(/hermes-auth=;/)
      expect(setCookie).toMatch(/Max-Age=0/)
      if (res.body) void res.body.cancel()

      expect(auth.isAuthenticated(makeContractRequest(token))).toBe(false)
    })
  })

  describe('GET /api/users', () => {
    it('anonymous → 401, regular_admin → 403', async () => {
      await expectJsonStatus(
        await invokeRouteHandler('@/routes/api/users', 'GET', makeContractRequest(null)),
        401,
      )
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users',
          'GET',
          makeContractRequest(regularToken),
        ),
        403,
      )
    })

    it('super_admin → 200 with sanitized listing (no passwordHash)', async () => {
      const { body } = await expectJsonStatus(
        await invokeRouteHandler('@/routes/api/users', 'GET', makeContractRequest(adminToken)),
        200,
      )
      const users = body.users as Array<Record<string, unknown>>
      expect(Array.isArray(users)).toBe(true)
      expect(users.some((u) => u.userId === adminId)).toBe(true)
      expect(users.some((u) => u.userId === regularId)).toBe(true)
      for (const u of users) {
        expect(u).not.toHaveProperty('passwordHash')
      }
    })
  })

  describe('POST /api/users', () => {
    const createdId = `created-${ts}`
    const createBody = JSON.stringify({
      userId: createdId,
      password: 'created-pw-1',
      displayName: 'Created User',
      role: 'regular_admin',
    })

    it('anonymous → 401, regular_admin → 403', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users',
          'POST',
          makeContractRequest(null, { method: 'POST', body: createBody }),
        ),
        401,
      )
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users',
          'POST',
          makeContractRequest(regularToken, { method: 'POST', body: createBody }),
        ),
        403,
      )
    })

    it('super_admin create succeeds → 201, may grant super_admin', async () => {
      const { body } = await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users',
          'POST',
          makeContractRequest(adminToken, { method: 'POST', body: createBody }),
        ),
        201,
      )
      harness.trackUser(createdId)
      const user = body.user as Record<string, unknown>
      expect(user.userId).toBe(createdId)
      expect(user.role).toBe('regular_admin')
      expect(user.displayName).toBe('Created User')
      expect(user).not.toHaveProperty('passwordHash')
    })

    it('duplicate create → 409', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users',
          'POST',
          makeContractRequest(adminToken, { method: 'POST', body: createBody }),
        ),
        409,
      )
    })
  })

  describe('PATCH /api/users/:id', () => {
    it('anonymous → 401', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(null, {
            method: 'PATCH',
            body: JSON.stringify({ displayName: 'x' }),
          }),
          { id: regularId },
        ),
        401,
      )
    })

    it('user changes own password → 200 (old password invalidated)', async () => {
      const res = await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(regularToken, {
            method: 'PATCH',
            body: JSON.stringify({ password: 'new-regular-pw-1' }),
          }),
          { id: regularId },
        ),
        200,
      )
      expect(res.body.user).not.toHaveProperty('passwordHash')

      // The old password must be invalidated (bcrypt hash was updated)
      const oldOk = await identity.authenticateUser(regularId, 'regular-pw-1')
      const newOk = await identity.authenticateUser(regularId, 'new-regular-pw-1')
      expect(oldOk).toBeNull()
      expect(newOk).not.toBeNull()
    })

    it("regular_admin changing another user's role → 403", async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(regularToken, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'super_admin' }),
          }),
          { id: victimId },
        ),
        403,
      )
    })

    it("super_admin adjusting another user's role → 200", async () => {
      const res = await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(adminToken, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'super_admin' }),
          }),
          { id: victimId },
        ),
        200,
      )
      expect((res.body.user as Record<string, unknown>).role).toBe('super_admin')

      // Restore, so the super-admin count for delete protection stays correct
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(adminToken, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'regular_admin' }),
          }),
          { id: victimId },
        ),
        200,
      )
    })

    it('super_admin cannot demote self → 400 (lockout protection)', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(adminToken, {
            method: 'PATCH',
            body: JSON.stringify({ role: 'regular_admin' }),
          }),
          { id: adminId },
        ),
        400,
      )
    })

    it('nonexistent user → 404', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'PATCH',
          makeContractRequest(adminToken, {
            method: 'PATCH',
            body: JSON.stringify({ displayName: 'x' }),
          }),
          { id: `nope-${ts}` },
        ),
        404,
      )
    })
  })

  describe('DELETE /api/users/:id', () => {
    const doomedId = `doomed-${ts}`

    it('anonymous → 401, regular_admin → 403', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(null, { method: 'DELETE' }),
          { id: victimId },
        ),
        401,
      )
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(regularToken, { method: 'DELETE' }),
          { id: victimId },
        ),
        403,
      )
    })

    it('super_admin deletes a regular user → 200', async () => {
      await identity.createUser({
        userId: doomedId,
        password: 'doomed-pw-1',
        role: 'regular_admin',
      })
      harness.trackUser(doomedId)
      const res = await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(adminToken, { method: 'DELETE' }),
          { id: doomedId },
        ),
        200,
      )
      expect(res.body.ok).toBe(true)
      expect(identity.userExists(doomedId)).toBe(false)
    })

    it('cannot delete self → 400', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(adminToken, { method: 'DELETE' }),
          { id: adminId },
        ),
        400,
      )
    })

    it('cannot delete the last super_admin → 400', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(adminToken, { method: 'DELETE' }),
          { id: adminId },
        ),
        400,
      )
    })

    it('nonexistent user → 404', async () => {
      await expectJsonStatus(
        await invokeRouteHandler(
          '@/routes/api/users.$id',
          'DELETE',
          makeContractRequest(adminToken, { method: 'DELETE' }),
          { id: `ghost-${ts}` },
        ),
        404,
      )
    })
  })
})
