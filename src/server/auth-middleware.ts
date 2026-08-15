import { randomBytes, timingSafeEqual } from 'node:crypto'
import { getRedisClient, getRedisClientSync } from './redis-client'
import { getUser, isMultiUserEnabled } from './identity'
import type { UserRole } from './identity'

const TOKENS_KEY = 'hermes:studio:tokens'
const TOKEN_USER_KEY = 'hermes:studio:token:user'
const TOKEN_TTL_S = 30 * 24 * 60 * 60 // 30 days

/**
 * In-memory session store — source of truth for the current process.
 * Backed by a Redis SET when REDIS_URL is set so tokens survive restarts.
 */
const validTokens = new Set<string>()

/**
 * Map of token -> userId for user identity tracking.
 */
const tokenToUserId = new Map<string, string>()

// On startup load persisted tokens from Redis into the in-memory Set
void getRedisClient().then(async (client) => {
  if (!client) return
  try {
    const tokens = await client.smembers(TOKENS_KEY)
    for (const t of tokens) validTokens.add(t)
    const userMappings = await client.hgetall(TOKEN_USER_KEY)
    for (const [token, userId] of Object.entries(userMappings)) {
      tokenToUserId.set(token, userId)
    }
    if (tokens.length > 0) {
      console.log(`[auth] Loaded ${tokens.length} session token(s) from Redis`)
    }
  } catch {
    // Redis unavailable — in-memory store continues
  }
})

/**
 * Generate a cryptographically secure session token.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Store a session token as valid, optionally associated with a user.
 */
export function storeSessionToken(token: string, userId?: string): void {
  validTokens.add(token)
  if (userId) {
    tokenToUserId.set(token, userId)
  }
  const client = getRedisClientSync()
  if (client) {
    void client.sadd(TOKENS_KEY, token).then(() =>
      client.expire(TOKENS_KEY, TOKEN_TTL_S),
    )
    if (userId) {
      void client.hset(TOKEN_USER_KEY, token, userId)
    }
  }
}

/**
 * Check if a session token is valid.
 */
export function isValidSessionToken(token: string): boolean {
  return validTokens.has(token)
}

/**
 * Get the user ID associated with a token, if any.
 */
export function getUserIdFromToken(token: string): string | undefined {
  return tokenToUserId.get(token)
}

/**
 * Remove a session token (logout).
 */
export function revokeSessionToken(token: string): void {
  validTokens.delete(token)
  tokenToUserId.delete(token)
  const client = getRedisClientSync()
  if (client) {
    void client.srem(TOKENS_KEY, token)
    void client.hdel(TOKEN_USER_KEY, token)
  }
}

/**
 * Check if password protection is enabled.
 */
export function isPasswordProtectionEnabled(): boolean {
  return Boolean(
    process.env.HERMES_PASSWORD && process.env.HERMES_PASSWORD.length > 0,
  )
}

/**
 * Verify password using timing-safe comparison.
 */
export function verifyPassword(password: string): boolean {
  const configured = process.env.HERMES_PASSWORD
  if (!configured || configured.length === 0) {
    return false
  }

  // Timing-safe comparison
  const passwordBuf = Buffer.from(password, 'utf8')
  const configuredBuf = Buffer.from(configured, 'utf8')

  // If lengths differ, still do a comparison to avoid timing leak
  if (passwordBuf.length !== configuredBuf.length) {
    return false
  }

  try {
    return timingSafeEqual(passwordBuf, configuredBuf)
  } catch {
    return false
  }
}

/**
 * Extract session token from cookie header.
 */
export function getSessionTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map((c) => c.trim())
  for (const cookie of cookies) {
    if (cookie.startsWith('hermes-auth=')) {
      return cookie.substring('hermes-auth='.length)
    }
  }
  return null
}

function isLocalRequest(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || '127.0.0.1'
  const localIPs = ['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']
  if (localIPs.includes(ip)) return true
  // Allow Tailscale (100.x.x.x) and private LAN ranges
  if (/^100\.\d+\.\d+\.\d+$/.test(ip)) return true
  if (/^192\.168\./.test(ip)) return true
  if (/^10\./.test(ip)) return true
  return false
}

/**
 * Check if the request is authenticated.
 * Returns true if:
 * - Password protection is disabled (single-user open mode), OR
 * - Request has a valid session token (single-user), OR
 * - Multi-user mode: request has a valid session token bound to a userId
 */
export function isAuthenticated(request: Request): boolean {
  // Multi-user mode: sessions must be bound to a concrete user, otherwise treat as unauthenticated
  if (isMultiUserEnabled()) {
    const token = getSessionTokenFromCookie(request.headers.get('cookie'))
    if (!token) return false
    if (!isValidSessionToken(token)) return false
    return getUserIdFromToken(token) !== undefined
  }

  // No password configured? No auth needed
  if (!isPasswordProtectionEnabled()) {
    return true
  }

  // Check for valid session token
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionTokenFromCookie(cookieHeader)

  if (!token) {
    return false
  }

  return isValidSessionToken(token)
}

export function requireLocalOrAuth(request: Request): boolean {
  if (!isPasswordProtectionEnabled()) {
    return isLocalRequest(request)
  }

  return isAuthenticated(request)
}

/**
 * Extract user ID from request.
 * Multi-user mode: ONLY the session-token bound userId (no env fallback —
 * otherwise any request could impersonate HERMES_USER_ID).
 * Single-user mode: session token mapping, then HERMES_USER_ID fallback.
 */
export function getUserIdFromRequest(request: Request): string | undefined {
  const cookieHeader = request.headers.get('cookie')
  const token = getSessionTokenFromCookie(cookieHeader)

  if (token) {
    const userId = getUserIdFromToken(token)
    if (userId) return userId
  }

  if (isMultiUserEnabled()) return undefined

  // Fallback for testing/single-user deployments
  return process.env.HERMES_USER_ID
}

/**
 * Get the current request user in multi-user mode; returns undefined in single-user mode
 * (no data isolation enabled). Used to filter data-level resources like local sessions by owner.
 */
export function getEffectiveSessionOwner(request: Request): string | undefined {
  if (!isMultiUserEnabled()) return undefined
  return getUserIdFromRequest(request)
}

/**
 * Resolve the effective role for the request.
 * Multi-user mode: identity lookup; unknown user → lowest privilege.
 * Single-user mode: the box owner is super_admin (full access).
 */
export function getUserRoleFromRequest(request: Request): UserRole {
  if (!isMultiUserEnabled()) return 'super_admin'

  const userId = getUserIdFromRequest(request)
  if (!userId) return 'regular_admin'

  return getUser(userId)?.role ?? 'regular_admin'
}

/**
 * Guard: require authentication. Returns a 401 Response when the request is
 * not authenticated, otherwise null (pass). All API endpoints must use this
 * instead of returning the raw boolean from isAuthenticated().
 */
export function requireAuth(request: Request): Response | null {
  if (isAuthenticated(request)) return null
  return Response.json(
    { ok: false, error: 'Unauthorized' },
    { status: 401 },
  )
}

export type RequiredRole = 'user' | 'admin'

/**
 * Guard: require authentication + role.
 *  - 'user': any authenticated user
 *  - 'admin': super_admin only
 * Returns a 401/403 Response when access is denied, otherwise null (pass).
 * Single-user mode: role checks pass for any authenticated request (owner).
 */
export function requireRole(
  request: Request,
  required: RequiredRole,
): Response | null {
  if (!isAuthenticated(request)) {
    return Response.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }
  if (!isMultiUserEnabled() || required === 'user') return null

  const role = getUserRoleFromRequest(request)
  if (role === 'super_admin') return null

  return Response.json(
    { ok: false, error: 'Forbidden: super_admin required' },
    { status: 403 },
  )
}

/**
 * Create a Set-Cookie header for the session token.
 */
export function createSessionCookie(token: string): string {
  // httpOnly: prevents JS access
  // secure: HTTPS only (disabled for local dev)
  // sameSite=strict: CSRF protection
  // path=/: available everywhere
  // maxAge: 30 days
  return `hermes-auth=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`
}
