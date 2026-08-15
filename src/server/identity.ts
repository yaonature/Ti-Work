/**
 * Identity and user core (G2).
 *
 * The identity foundation for multi-user RBAC:
 *  - Users are stored in Redis (a SET index + per-user Hash/string record), with an in-process
 *    memory cache for speed
 *  - Passwords are always bcrypt-hashed (see password-hash.ts); plaintext must never be stored
 *  - Roles: super_admin (system administrator, full permissions) / regular_admin (regular user,
 *    data-level permissions)
 *  - Users are loaded from Redis at startup; in multi-user mode ensureSeedAdmin() seeds the
 *    initial administrator
 *
 * Activation: TI_WORK_MULTIUSER=1 (or HERMES_MULTI_USER=true) enables multi-user mode.
 * When not activated, this project keeps its original single-password/single-user behavior and
 * the identity layer does not take part in authentication.
 */
import { getRedisClient, getRedisClientSync } from './redis-client'
import { hashPassword, verifyPasswordHash } from './password-hash'

export type UserRole = 'super_admin' | 'regular_admin'

export interface IdentityUser {
  userId: string
  displayName: string
  role: UserRole
  createdAt: number
  updatedAt: number
}

/** Internal storage shape: contains the password hash; must never be exposed externally */
export interface StoredUser extends IdentityUser {
  passwordHash: string
}

export interface CreateUserInput {
  userId: string
  displayName?: string
  password: string
  role?: UserRole
}

const USERS_KEY = 'hermes:studio:identity:users'
const USER_PREFIX = 'hermes:studio:identity:user:'

/** In-process user cache (same cache + Redis pattern as user-profiles.ts) */
const userCache = new Map<string, StoredUser>()

/** Hash used for constant-time comparison against unknown users (lazily generated, prevents user-enumeration timing attacks) */
let _dummyHash: string | null = null
async function dummyHash(): Promise<string> {
  if (!_dummyHash) _dummyHash = await hashPassword('timing-equalization-dummy')
  return _dummyHash
}

// Load users from Redis at startup
void getRedisClient().then(async (client) => {
  if (!client) return
  try {
    const userIds = await client.smembers(USERS_KEY)
    for (const userId of userIds) {
      const raw = await client.get(`${USER_PREFIX}${userId}`)
      if (raw) {
        try {
          userCache.set(userId, JSON.parse(raw) as StoredUser)
        } catch {
          // Skip corrupted records
        }
      }
    }
    if (userIds.length > 0) {
      console.log(`[identity] Loaded ${userIds.length} user(s) from Redis`)
    }
  } catch {
    // Fall back to pure in-memory mode when Redis is unavailable
  }
})

// ─── Mode switches ─────────────────────────────────────────────────────────

/**
 * Whether multi-user mode is enabled (TI_WORK_MULTIUSER=1 or HERMES_MULTI_USER=true).
 * When disabled, the original single-password behavior is kept and the identity layer
 * does not participate in authentication decisions.
 */
export function isMultiUserEnabled(): boolean {
  const v = process.env.TI_WORK_MULTIUSER ?? process.env.HERMES_MULTI_USER
  return v === '1' || v === 'true'
}

/**
 * Whether self-registration is enabled (TI_WORK_SELF_REGISTER=1 or HERMES_SELF_REGISTER=true).
 * Off by default: in enterprise multi-user scenarios, accounts are usually created by
 * administrators on the user management page.
 */
export function isSelfRegisterEnabled(): boolean {
  const v = process.env.TI_WORK_SELF_REGISTER ?? process.env.HERMES_SELF_REGISTER
  return v === '1' || v === 'true'
}

// ─── Queries ───────────────────────────────────────────────────────────────

/** Sanitize: public shape with the password hash stripped */
export function sanitizeUser(user: StoredUser): IdentityUser {
  return {
    userId: user.userId,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

export function getUser(userId: string): StoredUser | null {
  return userCache.get(userId) ?? null
}

export function getPublicUser(userId: string): IdentityUser | null {
  const user = userCache.get(userId)
  return user ? sanitizeUser(user) : null
}

export function userExists(userId: string): boolean {
  return userCache.has(userId)
}

export function userCount(): number {
  return userCache.size
}

/** All users (sanitized, sorted by userId, for the admin UI) */
export function listUsers(): Array<IdentityUser> {
  return [...userCache.values()]
    .map(sanitizeUser)
    .sort((a, b) => a.userId.localeCompare(b.userId))
}

// ─── Writes ────────────────────────────────────────────────────────────────

function persistToRedis(user: StoredUser): void {
  const client = getRedisClientSync()
  if (!client) return
  void client.sadd(USERS_KEY, user.userId)
  void client.set(`${USER_PREFIX}${user.userId}`, JSON.stringify(user))
}

/**
 * Create a user (password is bcrypt-hashed before persisting).
 * Throws an Error if the user already exists; when Redis is available, SADD atomicity
 * prevents concurrent duplicate creation.
 */
export async function createUser(input: CreateUserInput): Promise<IdentityUser> {
  const userId = input.userId.trim()
  if (!userId) throw new Error('userId is required')

  if (userCache.has(userId)) {
    throw new Error(`User already exists: ${userId}`)
  }

  const passwordHash = await hashPassword(input.password)
  const now = Date.now()
  const user: StoredUser = {
    userId,
    displayName: input.displayName?.trim() || userId,
    role: input.role ?? 'regular_admin',
    createdAt: now,
    updatedAt: now,
    passwordHash,
  }

  const client = getRedisClientSync()
  if (client) {
    const added = await client.sadd(USERS_KEY, userId)
    if (added === 0) {
      throw new Error(`User already exists: ${userId}`)
    }
    await client.set(`${USER_PREFIX}${userId}`, JSON.stringify(user))
  }

  userCache.set(userId, user)
  return sanitizeUser(user)
}

/**
 * Validate username/password. Unknown users also run a constant-time comparison and return
 * null, to prevent user enumeration.
 */
export async function authenticateUser(
  userId: string,
  password: string,
): Promise<IdentityUser | null> {
  const user = userCache.get(userId)
  if (!user) {
    await verifyPasswordHash(password, await dummyHash())
    return null
  }
  const ok = await verifyPasswordHash(password, user.passwordHash)
  return ok ? sanitizeUser(user) : null
}

export function updateUserRole(
  userId: string,
  role: UserRole,
): IdentityUser | null {
  const user = userCache.get(userId)
  if (!user) return null
  user.role = role
  user.updatedAt = Date.now()
  persistToRedis(user)
  return sanitizeUser(user)
}

export function updateUserDisplayName(
  userId: string,
  displayName: string,
): IdentityUser | null {
  const user = userCache.get(userId)
  if (!user) return null
  user.displayName = displayName.trim() || userId
  user.updatedAt = Date.now()
  persistToRedis(user)
  return sanitizeUser(user)
}

export async function updateUserPassword(
  userId: string,
  password: string,
): Promise<boolean> {
  const user = userCache.get(userId)
  if (!user) return false
  user.passwordHash = await hashPassword(password)
  user.updatedAt = Date.now()
  persistToRedis(user)
  return true
}

export async function deleteUser(userId: string): Promise<boolean> {
  const existed = userCache.delete(userId)
  const client = getRedisClientSync()
  if (client) {
    await client.srem(USERS_KEY, userId)
    await client.del(`${USER_PREFIX}${userId}`)
  }
  return existed
}

// ─── Seed administrator ─────────────────────────────────────────────────────

/**
 * Seed the initial administrator: in multi-user mode, when TI_WORK_ADMIN_PASSWORD (or
 * HERMES_ADMIN_PASSWORD) is configured and the system has no users yet, create a super_admin.
 * Idempotent: does nothing when users already exist or the target admin already exists.
 */
export async function ensureSeedAdmin(): Promise<boolean> {
  if (!isMultiUserEnabled()) return false
  const configured =
    process.env.TI_WORK_ADMIN_PASSWORD ?? process.env.HERMES_ADMIN_PASSWORD
  if (!configured || configured.length === 0) return false

  const adminId = (process.env.TI_WORK_ADMIN_USER ?? 'admin').trim() || 'admin'
  if (userCache.has(adminId)) return false

  const client = getRedisClientSync()
  const existing = client ? await client.scard(USERS_KEY) : userCache.size
  if (existing > 0) return false

  await createUser({
    userId: adminId,
    displayName: 'Administrator',
    password: configured,
    role: 'super_admin',
  })
  return true
}

// Startup flow: seed the admin after Redis finishes loading (when there are no users)
void getRedisClient().then(async (client) => {
  if (!client) return
  try {
    const seeded = await ensureSeedAdmin()
    if (seeded) console.log(`[identity] Seeded default admin user`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[identity] Seed admin skipped: ${msg}`)
  }
})
