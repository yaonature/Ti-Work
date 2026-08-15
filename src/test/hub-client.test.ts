/**
 * G8 contract tests — desktop hub connectivity (real HTTP fake hub + real outbox SQLite).
 *
 * Coverage (DoD: no collapse when offline, catch-up reports are neither duplicated nor lost,
 * login and validity are controlled by the hub):
 *  - connectHub: successful login (config+state persisted, featureSet/license delivered) / 401 rejection / hub unreachable
 *  - outbox: per-device monotonic seq, online catch-up drains in order, hub receives (tenant, device, seq) payloads
 *  - offline degradation: event endpoint 503 → events stay queued (depth > 0), catch-up clears after recovery
 *  - 401 report rejection → marked offline, events kept; successful heartbeat → back online and catch-up
 *  - heartbeat: 200 renews lease / 404 seat lost → offline
 *  - hubLoginGate: pass when not configured / pass within hard deadline (including grace) / reject past hard deadline (login controlled by hub)
 *  - disconnectHub: clears config+state, seat left for the hub TTL to reclaim
 *
 * Isolation: TI_WORK_HUB_* paths point to a temp directory; each case independently resets the outbox singleton.
 */
import { createServer } from 'node:http'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createTempDirHarness } from './harness/temp-dir-harness'
import {
  connectHub,
  disconnectHub,
  enqueueHubEvent,
  flushHubOutbox,
  hubLoginGate,
  hubStatus,
  outboxDepth,
  resetHubClientForTests,
  runHubHeartbeat,
} from '@/server/hub-client'
import { readHubConfig, readHubState } from '@/server/hub-state'

const DAY = 86_400_000
const TENANT = 'acme'
const EMAIL = 'alice@acme.com'
const PASSWORD = 'pw-123456'

let tempDirHarness: ReturnType<typeof createTempDirHarness>
let hub: Server
let hubUrl: string
let receivedEvents: Array<Record<string, unknown>> = []
let failEvents = false
let failEventsAuth = false
let failEventsLicense = false

function listen(): Promise<string> {
  return new Promise((resolve) => {
    hub.listen(0, '127.0.0.1', () => {
      const addr = hub.address()
      if (addr && typeof addr === 'object') {
        resolve(`http://127.0.0.1:${addr.port}`)
      }
    })
  })
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Array<Buffer> = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

beforeAll(async () => {
  tempDirHarness = createTempDirHarness('tiwork-hub-test-')
  process.env.TI_WORK_HUB_CONFIG_PATH = tempDirHarness.path('config.yaml')
  process.env.TI_WORK_HUB_STATE_PATH = tempDirHarness.path('hub-state.json')
  process.env.TI_WORK_HUB_OUTBOX_PATH = tempDirHarness.path('outbox.db')

  hub = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (req.method === 'POST' && url.pathname === '/api/auth/desktop/login') {
      const body = await readJson(req)
      if (
        body.email === EMAIL &&
        body.password === PASSWORD &&
        body.tenantId === TENANT
      ) {
        sendJson(res, 200, {
          token: 'jwt-token-1',
          leaseToken: 'lease-1',
          featureSet: ['lineage', 'audit', 'dashboard'],
          license: {
            edition: 'professional',
            expiresAt: Date.now() + 30 * DAY,
            hardDeadline: Date.now() + 30 * DAY + 14 * DAY,
            inGrace: false,
            seats: 10,
            activeSeats: 1,
          },
          account: { id: 'acc-1', tenantId: TENANT, email: EMAIL, displayName: 'Alice', role: 'operator' },
        })
        return
      }
      sendJson(res, 401, { error: 'invalid-credentials' })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/auth/desktop/heartbeat') {
      const body = await readJson(req)
      if (body.leaseToken === 'lease-1') {
        sendJson(res, 200, { ok: true })
        return
      }
      sendJson(res, 404, { error: 'lease-not-found' })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/events') {
      const auth = req.headers.authorization ?? ''
      if (auth !== 'Bearer jwt-token-1') {
        sendJson(res, 401, { error: 'unauthorized' })
        return
      }
      if (failEventsLicense) {
        sendJson(res, 403, { error: 'license-expired' })
        return
      }
      if (failEventsAuth) {
        sendJson(res, 401, { error: 'unauthorized' })
        return
      }
      if (failEvents) {
        sendJson(res, 503, { error: 'event-bus-unavailable' })
        return
      }
      const body = await readJson(req)
      receivedEvents.push(body)
      sendJson(res, 201, { ok: true, duplicate: false })
      return
    }
    sendJson(res, 404, { error: 'not-found' })
  })
  hubUrl = await listen()
})

beforeEach(() => {
  // Per-case independent state: clear the outbox/state/config files
  resetHubClientForTests()
  tempDirHarness.removeEntries([
    'config.yaml',
    'hub-state.json',
    'outbox.db',
    'outbox.db-wal',
    'outbox.db-shm',
  ])
  receivedEvents = []
  failEvents = false
  failEventsAuth = false
  failEventsLicense = false
})

afterEach(() => {
  disconnectHub()
  resetHubClientForTests()
})

afterAll(async () => {
  disconnectHub()
  resetHubClientForTests()
  await new Promise<void>((resolve) => hub.close(() => resolve()))
  delete process.env.TI_WORK_HUB_CONFIG_PATH
  delete process.env.TI_WORK_HUB_STATE_PATH
  delete process.env.TI_WORK_HUB_OUTBOX_PATH
  tempDirHarness.cleanup()
})

async function waitForDepth(target: number, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (outboxDepth() === target) return
    await new Promise((r) => setTimeout(r, 20))
  }
  expect(outboxDepth()).toBe(target)
}

async function waitForCondition(
  predicate: () => boolean,
  timeoutMs = 3000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 20))
  }
  expect(predicate()).toBe(true)
}

describe('G8 hub connection: login', () => {
  it('successful login: config/state persisted, featureSet and license snapshot delivered', async () => {
    const result = await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const config = readHubConfig()
    expect(config?.baseUrl).toBe(hubUrl)
    expect(config?.tenantId).toBe(TENANT)
    expect(config?.email).toBe(EMAIL)
    expect(config?.deviceId).toMatch(/^dev-/)
    const state = readHubState()
    expect(state?.leaseToken).toBe('lease-1')
    expect(state?.featureSet).toContain('lineage')
    expect(state?.license?.edition).toBe('professional')
    const status = hubStatus()
    expect(status.configured).toBe(true)
    expect(status.connected).toBe(true)
    expect(status.licenseExpired).toBe(false)
  })

  it('wrong credentials: hub 401 → connection refused, no state persisted', async () => {
    const result = await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: 'wrong-password',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid-credentials')
    expect(readHubConfig()).toBeNull()
    expect(readHubState()).toBeNull()
    expect(hubStatus().configured).toBe(false)
  })

  it('hub unreachable: returns hub-unreachable, no state persisted', async () => {
    const result = await connectHub({
      baseUrl: 'http://127.0.0.1:1',
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('hub-unreachable')
    expect(hubStatus().configured).toBe(false)
  })
})

describe('G8 event reporting and offline catch-up', () => {
  it('online reporting: monotonic seq, drains in order, hub receives (type, deviceId, seq) payloads', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    const state = readHubState()
    const deviceId = state?.deviceId ?? ''
    expect(deviceId).not.toBe('')

    enqueueHubEvent({ type: 'task.created', taskId: 't1', payload: { title: 'A' } })
    enqueueHubEvent({ type: 'run.started', taskId: 't1', runId: 'r1' })
    enqueueHubEvent({ type: 'task.moved', taskId: 't2', ownerId: 'alice' })

    await waitForDepth(0)

    expect(receivedEvents.map((e) => e.seq)).toEqual([1, 2, 3])
    expect(receivedEvents.map((e) => e.type)).toEqual([
      'task.created',
      'run.started',
      'task.moved',
    ])
    for (const ev of receivedEvents) {
      expect(ev.deviceId).toBe(deviceId)
      expect(typeof ev.payload).toBe('object')
    }
    // Payload passes through as-is (forwarding adds system fields in hub-forward; enqueue here does not modify it)
    expect(
      (receivedEvents[0]?.payload as Record<string, unknown> | undefined)?.title,
    ).toBe('A')
    expect(hubStatus().outboxDepth).toBe(0)
  })

  it('offline degradation: event endpoint 503 → stays queued; catch-up clears after recovery (no loss, no duplicates)', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    failEvents = true
    enqueueHubEvent({ type: 'task.created', taskId: 'off1' })
    enqueueHubEvent({ type: 'run.started', taskId: 'off1', runId: 'off-r1' })
    // Wait for the automatic catch-up to fail (stays queued)
    await new Promise((r) => setTimeout(r, 100))
    expect(outboxDepth()).toBe(2)
    expect(receivedEvents.length).toBe(0)

    // Back online → manual catch-up
    failEvents = false
    const flush = await flushHubOutbox()
    expect(flush.sent).toBe(2)
    expect(flush.failed).toBe(false)
    expect(outboxDepth()).toBe(0)
    expect(receivedEvents.map((e) => e.seq)).toEqual([1, 2])
  })

  it('report 401: marked offline, events kept; heartbeat recovery triggers automatic catch-up', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    failEventsAuth = true
    enqueueHubEvent({ type: 'task.created', taskId: 'auth1' })
    // Catch-up is blocked by 401 → marked offline, events kept
    await waitForCondition(() => hubStatus().lastError === 'unauthorized')
    expect(outboxDepth()).toBe(1)
    expect(hubStatus().connected).toBe(false)

    // Heartbeat succeeds (heartbeat does not validate the token) → back online
    expect(await runHubHeartbeat()).toBe(true)
    expect(hubStatus().connected).toBe(true)

    // Token restored → catch-up succeeds
    failEventsAuth = false
    const flush = await flushHubOutbox()
    expect(flush.sent).toBe(1)
    expect(outboxDepth()).toBe(0)
  })

  it('report 403 (license expired): events kept, marked offline, no further retries', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    failEventsLicense = true
    enqueueHubEvent({ type: 'task.created', taskId: 'exp1' })
    await waitForCondition(() => hubStatus().lastError === 'license-expired')
    const status = hubStatus()
    expect(status.connected).toBe(false)
    expect(status.lastError).toBe('license-expired')
    expect(outboxDepth()).toBe(1)
  })
})

describe('G8 heartbeat (floating seat lease renewal)', () => {
  it('successful heartbeat: lastHeartbeatAt refreshed, back online', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    expect(await runHubHeartbeat()).toBe(true)
    const status = hubStatus()
    expect(status.connected).toBe(true)
    expect(status.lastHeartbeatAt).toBeGreaterThan(0)
  })

  it('seat lost (404): marked offline', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    // Corrupt the leaseToken manually to simulate the seat being reclaimed
    const state = readHubState()
    if (!state) throw new Error('no state')
    state.leaseToken = 'stale-lease'
    const { writeHubState } = await import('@/server/hub-state')
    writeHubState(state)

    expect(await runHubHeartbeat()).toBe(false)
    expect(hubStatus().connected).toBe(false)
    expect(hubStatus().lastError).toBe('lease-not-found')
  })
})

describe('G8 login gate (validity controlled by the hub)', () => {
  it('not connected to a hub: pass', () => {
    expect(hubLoginGate()).toEqual({ ok: true })
  })

  it('connected within hard deadline: pass (including grace period)', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    const now = Date.now()
    expect(hubLoginGate(now).ok).toBe(true)
    // Officially expired + 5 days (within the grace period)
    expect(hubLoginGate(now + 35 * DAY).ok).toBe(true)
  })

  it('past hard deadline (expiresAt+graceDays): login rejected', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    const gate = hubLoginGate(Date.now() + 30 * DAY + 14 * DAY + 1_000)
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.reason).toBe('license-expired')
  })
})

describe('G8 disconnect', () => {
  it('disconnect: config and state cleared, status back to unconfigured', async () => {
    await connectHub({
      baseUrl: hubUrl,
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
    })
    expect(hubStatus().configured).toBe(true)
    disconnectHub()
    expect(readHubConfig()).toBeNull()
    expect(readHubState()).toBeNull()
    const status = hubStatus()
    expect(status.configured).toBe(false)
    expect(status.connected).toBe(false)
  })
})
