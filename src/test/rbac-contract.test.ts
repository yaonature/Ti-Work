/**
 * G2 contract tests — RBAC permission matrix (real Redis + identity + guards).
 *
 * Matrix: endpoint × role × expected status code.
 *  - anonymous requests → 401
 *  - admin-only endpoints → 403 for regular_admin (super_admin only)
 *  - in multi-user mode, orphan tokens (not bound to a userId) are treated as unauthenticated
 *
 * The Redis contract suite is skipped entirely when TI_WORK_TEST_REDIS_URL is not set (provided by CI).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createContractAuthHarness,
  expectResponseStatus,
  invokeRouteHandler,
  makeContractRequest,
  seedUser,
} from './harness/contract-harness'
import { getTestRedisUrl } from './harness/redis-harness'

const redisUrl = getTestRedisUrl()

// Endpoints with historical class A/B defects (previously unauthenticated or boolean misuse)
const AUTH_FIX_ENDPOINTS: Array<[string, string, string]> = [
  ['@/routes/api/events', 'GET', '/api/events'],
  ['@/routes/api/oauth.device-code', 'POST', '/api/oauth/device-code'],
  ['@/routes/api/oauth.poll-token', 'POST', '/api/oauth/poll-token'],
  ['@/routes/api/hermes-config', 'GET', '/api/hermes-config'],
  ['@/routes/api/mcp/servers', 'GET', '/api/mcp/servers'],
  ['@/routes/api/mcp/reload', 'POST', '/api/mcp/reload'],
  ['@/routes/api/connection-status', 'GET', '/api/connection-status'],
]

// Admin-only endpoints (super_admin only; regular_admin must get 403)
const ADMIN_ONLY_ENDPOINTS: Array<[string, string, string]> = [
  ['@/routes/api/hermes-config', 'PATCH', '/api/hermes-config PATCH'],
  ['@/routes/api/mcp/servers', 'PUT', '/api/mcp/servers PUT'],
  ['@/routes/api/systemd-control', 'POST', '/api/systemd-control'],
  ['@/routes/api/start-hermes', 'POST', '/api/start-hermes'],
  ['@/routes/api/skills/settings', 'GET', '/api/skills/settings'],
  ['@/routes/api/conductor-spawn', 'POST', '/api/conductor-spawn'],
]

describe.skipIf(!redisUrl)('RBAC permission matrix contract (real Redis)', () => {
  let auth: typeof import('@/server/auth-middleware')
  let harness: Awaited<ReturnType<typeof createContractAuthHarness>>

  const ts = Date.now()
  const adminId = `admin-${ts}`
  const regularId = `user-${ts}`
  let adminToken = ''
  let regularToken = ''
  let orphanToken = ''

  beforeAll(async () => {
    harness = await createContractAuthHarness({
      redisUrl: redisUrl!,
      env: {
        TI_WORK_MULTIUSER: '1',
        HERMES_USER_ID: 'intruder-owner',
      },
      users: [
        seedUser(adminId, 'admin-pw-1', 'super_admin'),
        seedUser(regularId, 'regular-pw-1', 'regular_admin'),
      ],
    })
    auth = harness.auth
    adminToken = harness.tokensByUserId[adminId]
    regularToken = harness.tokensByUserId[regularId]
    orphanToken = harness.issueToken() // orphan token: not bound to a user
  })

  afterAll(async () => {
    await harness.cleanup()
  })

  describe('Session contract (multi-user mode)', () => {
    it('no cookie → unauthenticated', () => {
      expect(auth.isAuthenticated(makeContractRequest(null))).toBe(false)
    })

    it('unknown token → unauthenticated', () => {
      expect(auth.isAuthenticated(makeContractRequest('deadbeef0000'))).toBe(false)
    })

    it('orphan token (not bound to a userId) → rejected in multi-user mode', () => {
      expect(auth.isAuthenticated(makeContractRequest(orphanToken))).toBe(false)
    })

    it('token bound to a user → authenticated', () => {
      expect(auth.isAuthenticated(makeContractRequest(adminToken))).toBe(true)
      expect(auth.isAuthenticated(makeContractRequest(regularToken))).toBe(true)
    })

    it('getUserIdFromRequest trusts only the token binding, ignoring HERMES_USER_ID', () => {
      expect(auth.getUserIdFromRequest(makeContractRequest(adminToken))).toBe(adminId)
      expect(auth.getUserIdFromRequest(makeContractRequest(regularToken))).toBe(
        regularId,
      )
      expect(auth.getUserIdFromRequest(makeContractRequest(null))).toBeUndefined()
      expect(auth.getUserIdFromRequest(makeContractRequest(orphanToken))).toBeUndefined()
    })

    it('getUserRoleFromRequest: resolves roles from the identity table; unknown users get the least privilege', () => {
      expect(auth.getUserRoleFromRequest(makeContractRequest(adminToken))).toBe(
        'super_admin',
      )
      expect(auth.getUserRoleFromRequest(makeContractRequest(regularToken))).toBe(
        'regular_admin',
      )
      expect(auth.getUserRoleFromRequest(makeContractRequest(orphanToken))).toBe(
        'regular_admin',
      )
      expect(auth.getUserRoleFromRequest(makeContractRequest(null))).toBe(
        'regular_admin',
      )
    })
  })

  describe('Guard status code matrix', () => {
    it('requireAuth: anonymous 401, authenticated passes', () => {
      expectResponseStatus(auth.requireAuth(makeContractRequest(null))!, 401)
      expect(auth.requireAuth(makeContractRequest(adminToken))).toBeNull()
      expect(auth.requireAuth(makeContractRequest(regularToken))).toBeNull()
    })

    it("requireRole 'user': anonymous 401, any role passes", () => {
      expectResponseStatus(auth.requireRole(makeContractRequest(null), 'user')!, 401)
      expect(auth.requireRole(makeContractRequest(adminToken), 'user')).toBeNull()
      expect(auth.requireRole(makeContractRequest(regularToken), 'user')).toBeNull()
    })

    it("requireRole 'admin': anonymous 401, regular_admin 403, super_admin passes", () => {
      expectResponseStatus(auth.requireRole(makeContractRequest(null), 'admin')!, 401)
      expectResponseStatus(auth.requireRole(makeContractRequest(regularToken), 'admin')!, 403)
      expect(auth.requireRole(makeContractRequest(adminToken), 'admin')).toBeNull()
    })
  })

  describe('Single-user mode fallback behavior', () => {
    it('multi-user not enabled: anonymous passes without a password, role guards do not block, HERMES_USER_ID fallback is preserved', () => {
      delete process.env.TI_WORK_MULTIUSER
      delete process.env.HERMES_PASSWORD
      try {
        expect(auth.isAuthenticated(makeContractRequest(null))).toBe(true)
        expect(auth.requireRole(makeContractRequest(null), 'admin')).toBeNull()
        expect(auth.getUserRoleFromRequest(makeContractRequest(null))).toBe(
          'super_admin',
        )
        expect(auth.getUserIdFromRequest(makeContractRequest(null))).toBe(
          'intruder-owner',
        )
      } finally {
        process.env.TI_WORK_MULTIUSER = '1'
      }
    })
  })

  describe('Endpoint access matrix (anonymous → 401)', () => {
    for (const [modulePath, method, label] of AUTH_FIX_ENDPOINTS) {
      it(`${label} anonymous request returns 401`, async () => {
        const body = method === 'POST' ? '{}' : undefined
        const res = await invokeRouteHandler(
          modulePath,
          method,
          makeContractRequest(null, { method, body }),
        )
        expectResponseStatus(res, 401)
      })
    }
  })

  describe('Admin endpoint access matrix (regular_admin → 403)', () => {
    for (const [modulePath, method, label] of ADMIN_ONLY_ENDPOINTS) {
      it(`${label} anonymous returns 401, regular_admin returns 403`, async () => {
        const body = method === 'POST' || method === 'PUT' || method === 'PATCH'
          ? '{}'
          : undefined

        const anon = await invokeRouteHandler(
          modulePath,
          method,
          makeContractRequest(null, { method, body }),
        )
        expectResponseStatus(anon, 401)

        const regular = await invokeRouteHandler(
          modulePath,
          method,
          makeContractRequest(regularToken, { method, body }),
        )
        expectResponseStatus(regular, 403)
      })
    }
  })
})
