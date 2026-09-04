import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GatewayCapabilities } from '@/server/gateway-capabilities'
import {
  GatewayError,
  gatewayFetch,
  gatewayJson,
  gatewayUrl,
} from '@/server/agent-hub-client'
import {
  isAgentAccessDenied,
  requireAgentAccess,
} from '@/server/agent-unified-access'
import * as gatewayCapabilities from '@/server/gateway-capabilities'
import * as authMiddleware from '@/server/auth-middleware'

// 统一访问层 / 统一网关客户端的回归测试（DESK-02：Agent Unified Access Layer）。
// grounding：gateway-capabilities 负责探测、auth-middleware 负责鉴权，两者在测试中被
// 整体 mock，以隔离宿主环境副作用；被测主体 agent-hub-client / agent-unified-access
// 保留真实实现，从而可以确定性地断言 URL 拼接、Bearer 注入、错误归一化与访问裁决。

vi.mock('@/server/gateway-capabilities', () => ({
  HERMES_API: 'http://127.0.0.1:8642',
  authHeaders: vi.fn(() => ({ authorization: 'Bearer test-token' })),
  ensureGatewayProbed: vi.fn().mockResolvedValue(undefined),
  getCapabilities: vi.fn(),
  isGatewayReachable: vi.fn(),
}))

vi.mock('@/server/auth-middleware', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  getUserIdFromRequest: vi.fn(() => 'user-1'),
  getUserRoleFromRequest: vi.fn(() => 'admin'),
  getEffectiveSessionOwner: vi.fn(() => 'org-1'),
}))

const FULL_CAPABILITIES = {
  health: true,
  chatCompletions: true,
  models: true,
  streaming: true,
  probed: true,
  sessions: true,
  enhancedChat: true,
  skills: true,
  memory: true,
  config: true,
  jobs: true,
} as GatewayCapabilities

const fetchMock = vi.fn<typeof fetch>()
vi.stubGlobal('fetch', fetchMock)

afterEach(() => {
  vi.clearAllMocks()
})

beforeEach(() => {
  vi.mocked(gatewayCapabilities.getCapabilities).mockReturnValue(
    FULL_CAPABILITIES,
  )
  vi.mocked(gatewayCapabilities.isGatewayReachable).mockReturnValue(true)
  vi.mocked(authMiddleware.requireAuth).mockReturnValue(null)
  vi.mocked(authMiddleware.requireRole).mockReturnValue(null)
})

describe('agent-hub-client.gatewayUrl()', () => {
  it('uses HERMES_API as base joined with leading slash', () => {
    expect(gatewayUrl('/v1/runs')).toBe('http://127.0.0.1:8642/v1/runs')
    expect(gatewayUrl('v1/models')).toBe('http://127.0.0.1:8642/v1/models')
  })

  it('appends search whether or not it carries the ? prefix', () => {
    expect(gatewayUrl('/v1/runs', 'force=1')).toBe(
      'http://127.0.0.1:8642/v1/runs?force=1',
    )
    expect(gatewayUrl('/v1/models', '?limit=5')).toBe(
      'http://127.0.0.1:8642/v1/models?limit=5',
    )
  })
})

describe('agent-hub-client.gatewayFetch()', () => {
  it('injects default Bearer and stringifies object bodies', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    const res = await gatewayFetch('/v1/runs', {
      method: 'POST',
      body: { model: 'x' },
    })

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://127.0.0.1:8642/v1/runs')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer test-token')
    expect(headers.get('content-type')).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ model: 'x' }))
    expect(res).toBeInstanceOf(Response)
  })

  it('skips Bearer injection when skipAuth is set', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await gatewayFetch('/health', { skipAuth: true })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.has('authorization')).toBe(false)
  })

  it('leaves string bodies untouched and does not set content-type', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    await gatewayFetch('/v1/runs', { method: 'POST', body: 'raw-text' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBe('raw-text')
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBeNull()
  })
})

describe('agent-hub-client.gatewayJson()', () => {
  it('returns parsed JSON on 2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    await expect(gatewayJson('/v1/models')).resolves.toEqual({ ok: true })
  })

  it('throws GatewayError with status/path/method/body on non-2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response('bad gateway', { status: 502 }),
    )
    const err = await gatewayJson('/v1/models', {
      method: 'POST',
    }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(GatewayError)
    const gatewayError = err as GatewayError
    expect(gatewayError.status).toBe(502)
    expect(gatewayError.path).toBe('/v1/models')
    expect(gatewayError.method).toBe('POST')
    expect(gatewayError.body).toBe('bad gateway')
  })
})

describe('agent-unified-access.requireAgentAccess()', () => {
  it('returns the auth failure Response when requireAuth denies', async () => {
    const denied = Response.json({ ok: false }, { status: 401 })
    vi.mocked(authMiddleware.requireAuth).mockReturnValue(denied)

    const result = await requireAgentAccess(new Request('http://x/'), {})
    expect(result).toBe(denied)
    expect(isAgentAccessDenied(result)).toBe(true)
  })

  it('applies the role guard when role is requested (403)', async () => {
    const denied = Response.json({ ok: false }, { status: 403 })
    vi.mocked(authMiddleware.requireRole).mockReturnValue(denied)

    const result = await requireAgentAccess(new Request('http://x/'), {
      role: 'admin',
    })
    expect(result).toBe(denied)
    expect(isAgentAccessDenied(result)).toBe(true)
  })

  it('returns a 503 when the requested capability is missing', async () => {
    vi.mocked(gatewayCapabilities.getCapabilities).mockReturnValue({
      ...FULL_CAPABILITIES,
      jobs: false,
    })

    const result = await requireAgentAccess(new Request('http://x/'), {
      capability: 'jobs',
      capabilityMessage: 'jobs unavailable',
    })
    expect(result).toBeInstanceOf(Response)
    const denied = result as Response
    expect(denied.status).toBe(503)
    expect(await denied.json()).toMatchObject({ ok: false, error: 'jobs unavailable' })
  })

  it('returns a context with traceId/role/user when access is granted', async () => {
    const result = await requireAgentAccess(new Request('http://x/'), {
      capability: 'jobs',
    })

    expect(isAgentAccessDenied(result)).toBe(false)
    if (isAgentAccessDenied(result)) {
      throw new Error('expected agent access to be granted')
    }
    const ctx = result
    expect(ctx.role).toBe('admin')
    expect(ctx.userId).toBe('user-1')
    expect(ctx.scopeOwner).toBe('org-1')
    expect(ctx.gatewayReachable).toBe(true)
    expect(ctx.gateway.jobs).toBe(true)
    expect(ctx.traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})
