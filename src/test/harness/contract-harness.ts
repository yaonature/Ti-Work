import type { Redis } from 'ioredis'
import { expect } from 'vitest'
import { createRedisHarness } from './redis-harness'
import type {
  CreateUserInput,
  UserRole,
} from '@/server/identity'

export const IDENTITY_USERS_KEY = 'hermes:studio:identity:users'
const USER_PREFIX = 'hermes:studio:identity:user:'
const TOKENS_KEY = 'hermes:studio:tokens'
const TOKEN_USER_KEY = 'hermes:studio:token:user'

type EndpointModule = {
  Route: {
    options?: {
      server?: {
        handlers?: Record<
          string,
          (ctx: {
            request: Request
            params?: Record<string, string>
          }) => unknown
        >
      }
    }
  }
}

export interface ContractRequestInit {
  method?: string
  body?: BodyInit | null
  json?: unknown
  path?: string
  headers?: HeadersInit
}

export interface ContractJsonResponse {
  response: Response
  status: number
  body: Record<string, unknown>
}

export interface ContractSeedUser extends CreateUserInput {
  session?: 'bound' | 'orphan' | 'none'
}

export interface ContractAuthHarness {
  redis: Redis
  identity: typeof import('@/server/identity')
  auth: typeof import('@/server/auth-middleware')
  createdUserIds: Array<string>
  createdTokens: Array<string>
  tokensByUserId: Record<string, string>
  trackUser: (userId: string) => void
  trackToken: (token: string) => void
  issueToken: (userId?: string) => string
  createUser: (
    input: CreateUserInput,
    session?: ContractSeedUser['session'],
  ) => Promise<string | null>
  cleanup: () => Promise<void>
}

export function makeContractRequest(
  token: string | null,
  init?: ContractRequestInit,
): Request {
  const headers = new Headers(init?.headers)
  if (token) headers.set('cookie', `hermes-auth=${token}`)
  const body = init?.json === undefined
    ? (init?.body ?? null)
    : JSON.stringify(init.json)
  if (body !== null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  return new Request(`http://localhost${init?.path ?? '/api/contract'}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  })
}

export async function invokeRouteHandler(
  modulePath: string,
  method: string,
  request: Request,
  params?: Record<string, string>,
): Promise<unknown> {
  const mod = (await import(modulePath)) as EndpointModule
  const handler = mod.Route.options?.server?.handlers?.[method]
  if (!handler) throw new Error(`handler not found: ${modulePath} ${method}`)
  return handler({ request, params })
}

export function expectResponseStatus(res: unknown, status: number): Response {
  expect(res instanceof Response, `expected Response, got ${typeof res}`).toBe(
    true,
  )
  const response = res as Response
  expect(response.status).toBe(status)
  return response
}

export async function expectJsonStatus(
  res: unknown,
  status: number,
): Promise<ContractJsonResponse> {
  const response = expectResponseStatus(res, status)
  const body = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  return { response, status: response.status, body }
}

function setEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

export async function createContractAuthHarness(options: {
  redisUrl: string
  env?: Record<string, string | undefined>
  users?: Array<ContractSeedUser>
}): Promise<ContractAuthHarness> {
  const previousEnv = new Map<string, string | undefined>()
  const envEntries = Object.entries({
    REDIS_URL: options.redisUrl,
    ...options.env,
  })
  for (const [key, value] of envEntries) {
    previousEnv.set(key, process.env[key])
    setEnvValue(key, value)
  }

  const { getRedisClient } = await import('@/server/redis-client')
  const client = await getRedisClient()
  expect(client).not.toBeNull()

  const identity = await import('@/server/identity')
  const auth = await import('@/server/auth-middleware')
  const redis = await createRedisHarness(options.redisUrl)

  const createdUserIds: Array<string> = []
  const createdTokens: Array<string> = []
  const tokensByUserId: Record<string, string> = {}

  const trackUser = (userId: string): void => {
    if (!createdUserIds.includes(userId)) createdUserIds.push(userId)
  }

  const trackToken = (token: string): void => {
    if (!createdTokens.includes(token)) createdTokens.push(token)
  }

  const issueToken = (userId?: string): string => {
    const token = auth.generateSessionToken()
    auth.storeSessionToken(token, userId)
    trackToken(token)
    if (userId) tokensByUserId[userId] = token
    return token
  }

  const createUser = async (
    input: CreateUserInput,
    session: ContractSeedUser['session'] = 'none',
  ): Promise<string | null> => {
    await identity.createUser(input)
    trackUser(input.userId)
    if (session === 'bound') {
      return issueToken(input.userId)
    }
    if (session === 'orphan') {
      return issueToken()
    }
    return null
  }

  for (const user of options.users ?? []) {
    const { session, ...input } = user
    await createUser(input, session)
  }

  return {
    redis,
    identity,
    auth,
    createdUserIds,
    createdTokens,
    tokensByUserId,
    trackUser,
    trackToken,
    issueToken,
    createUser,
    cleanup: async () => {
      for (const userId of createdUserIds) {
        await redis.srem(IDENTITY_USERS_KEY, userId)
        await redis.del(identityUserKey(userId))
      }
      for (const token of createdTokens) {
        await redis.srem(TOKENS_KEY, token)
        await redis.hdel(TOKEN_USER_KEY, token)
      }
      await redis.quit()
      for (const [key, value] of previousEnv.entries()) {
        setEnvValue(key, value)
      }
    },
  }
}

export async function deleteKeysByPrefix(
  redis: Redis,
  keyPrefix: string,
): Promise<void> {
  const keys = await redis.keys(`${keyPrefix}:*`)
  if (keys.length > 0) await redis.del(...keys)
}

export async function deleteIdentityUser(
  redis: Redis,
  userId: string,
): Promise<void> {
  await redis.srem(IDENTITY_USERS_KEY, userId)
  await redis.del(identityUserKey(userId))
}

export function identityUserKey(userId: string): string {
  return `${USER_PREFIX}${userId}`
}

export async function readStoredIdentityUser(
  redis: Redis,
  userId: string,
): Promise<Record<string, unknown> | null> {
  const raw = await redis.get(identityUserKey(userId))
  if (!raw) return null
  return JSON.parse(raw) as Record<string, unknown>
}

export function seedUser(
  userId: string,
  password: string,
  role: UserRole,
): ContractSeedUser {
  return { userId, password, role, session: 'bound' }
}
