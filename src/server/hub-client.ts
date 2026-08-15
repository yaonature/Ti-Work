/**
 * G8 desktop hub connection — hub client (login/heartbeat/event reporting/offline backfill).
 *
 * Connection contract (mirrors the Ti-Work-Web hub):
 *  - POST {baseUrl}/api/auth/desktop/login  {tenantId, email, password, deviceId}
 *      → {token, leaseToken, featureSet, license:{edition, expiresAt, hardDeadline, inGrace, seats, activeSeats}}
 *  - POST {baseUrl}/api/auth/desktop/heartbeat {leaseToken} → {ok:true}
 *  - POST {baseUrl}/api/events  Bearer <token>  {type, deviceId, seq, taskId, runId, ownerId, payload}
 *      → 201 {ok, duplicate} / 503 event-bus-unavailable
 *
 * Offline backfill: every reported event is first enqueued into a local outbox (SQLite,
 * seq is a monotonic device-local sequence), and the hub dedupes idempotently by
 * (tenant, device, seq); when offline/hub-unavailable, events stay queued, and after the
 * heartbeat recovers they are backfilled in seq order (nothing lost, nothing duplicated).
 *
 * Test isolation: TI_WORK_HUB_OUTBOX_PATH overrides the outbox path (see path override
 * in hub-state.ts).
 */
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import {
  clearHubConfig,
  clearHubState,
  generateDeviceId,
  readHubConfig,
  readHubState,
  writeHubConfig,
  writeHubState,
} from './hub-state'
import type { HubConfig, HubLicenseSnapshot, HubState } from './hub-state'
import type { EnterpriseConfig } from './hub-state'
import { getHermesEnvPath, writeEnvValue } from './env-models'

const _require = createRequire(import.meta.url)
type SqliteDb = import('better-sqlite3').Database

const DATA_DIR = join(process.cwd(), '.runtime')
const outboxPath = () =>
  process.env.TI_WORK_HUB_OUTBOX_PATH ?? join(DATA_DIR, 'hub-outbox.db')

const HTTP_TIMEOUT_MS = 8_000
const HEARTBEAT_INTERVAL_MS = 60_000
const FLUSH_INTERVAL_MS = 10_000
const FLUSH_BATCH = 100

export interface HubEventInput {
  type: string
  taskId?: string | null
  runId?: string | null
  ownerId?: string | null
  payload?: Record<string, unknown> | null
}

export interface HubConnectInput {
  baseUrl: string
  tenantId: string
  email: string
  password: string
  deviceId?: string
}

export interface HubStatus {
  configured: boolean
  connected: boolean
  baseUrl: string
  tenantId: string
  email: string
  deviceId: string
  featureSet: Array<string>
  license: HubLicenseSnapshot | null
  licenseExpired: boolean
  inGrace: boolean
  lastHeartbeatAt: number | null
  disconnectedAt: number | null
  lastError: string | null
  outboxDepth: number
  /** 企业统一下发配置（含模型白名单；null = 非企业模式） */
  enterprise: EnterpriseConfig | null
}

// ─── Outbox (SQLite local queue) ───────────────────────────────────────────

let _outbox: SqliteDb | null = null
let _outboxInitAttempted = false

function getOutbox(): SqliteDb | null {
  if (_outboxInitAttempted) return _outbox
  _outboxInitAttempted = true
  try {
    const p = outboxPath()
    mkdirSync(join(p, '..'), { recursive: true })
    const Database = _require('better-sqlite3') as typeof import('better-sqlite3')
    const db = new Database(p)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS outbox (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT    NOT NULL,
        task_id    TEXT,
        run_id     TEXT,
        owner_id   TEXT,
        payload    TEXT    NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_outbox_seq ON outbox (seq);
    `)
    _outbox = db
    return db
  } catch {
    console.log('[hub] outbox unavailable — event reporting degraded to drop (local features unaffected)')
    return null
  }
}

/**
 * Test-only reset: close and clear the outbox connection and the backfill lock
 * (paired with TI_WORK_HUB_OUTBOX_PATH isolation).
 */
export function resetHubClientForTests(): void {
  stopTicker()
  if (_outbox) {
    try {
      _outbox.close()
    } catch {
      // Already closed — ignore
    }
    _outbox = null
  }
  _outboxInitAttempted = false
  flushing = false
}

/** Number of pending backfill events (for status display) */
export function outboxDepth(): number {
  const db = getOutbox()
  if (!db) return 0
  try {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM outbox').get() as { n: number }
    return n
  } catch {
    return 0
  }
}

interface OutboxRow {
  seq: number
  event_type: string
  task_id: string | null
  run_id: string | null
  owner_id: string | null
  payload: string
}

function enqueueEvent(input: HubEventInput): number | null {
  const db = getOutbox()
  if (!db) return null
  try {
    const res = db
      .prepare(
        `INSERT INTO outbox (event_type, task_id, run_id, owner_id, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.type,
        input.taskId ?? null,
        input.runId ?? null,
        input.ownerId ?? null,
        JSON.stringify(input.payload ?? {}),
        Date.now(),
      )
    return Number(res.lastInsertRowid)
  } catch {
    return null
  }
}

function listOutbox(limit = FLUSH_BATCH): Array<OutboxRow> {
  const db = getOutbox()
  if (!db) return []
  try {
    return db
      .prepare('SELECT * FROM outbox ORDER BY seq ASC LIMIT ?')
      .all(limit) as Array<OutboxRow>
  } catch {
    return []
  }
}

function deleteOutboxRows(seqs: Array<number>): void {
  const db = getOutbox()
  if (!db || seqs.length === 0) return
  try {
    const stmt = db.prepare('DELETE FROM outbox WHERE seq = ?')
    for (const seq of seqs) stmt.run(seq)
  } catch {
    // Cleanup failure does not affect later events (duplicate backfill is deduped
    // idempotently by the hub)
  }
}

// ─── Hub HTTP calls ────────────────────────────────────────────────────────

async function hubRequest(
  state: HubState,
  pathname: string,
  body: unknown,
  useAuth: boolean,
): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (useAuth) headers.Authorization = `Bearer ${state.token}`
    const res = await fetch(`${state.baseUrl.replace(/\/+$/, '')}${pathname}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await res.text()
    let data: unknown = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    return { status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Login / disconnect ────────────────────────────────────────────────────

/**
 * Connect to the hub: call the hub desktop login (license check + floating seat acquisition +
 * feature-set delivery), then on success persist config and session state and start the
 * heartbeat/backfill timers.
 */
export async function connectHub(
  input: HubConnectInput,
): Promise<{ ok: true; status: HubStatus } | { ok: false; error: string }> {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, '')
  const tenantId = input.tenantId.trim()
  const email = input.email.trim()
  const password = input.password
  if (!baseUrl || !tenantId || !email || !password) {
    return { ok: false, error: '缺少必填字段：baseUrl / tenantId / email / password' }
  }

  const deviceId = input.deviceId?.trim() || generateDeviceId()
  const config: HubConfig = { baseUrl, tenantId, email, deviceId }

  let status: number
  let data: unknown
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
    try {
      const res = await fetch(`${baseUrl}/api/auth/desktop/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, email, password, deviceId }),
        signal: controller.signal,
      })
      status = res.status
      data = await res.json().catch(() => null)
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return { ok: false, error: 'hub-unreachable' }
  }

  if (status !== 200) {
    const body = (data ?? {}) as Record<string, unknown>
    const reason = typeof body.error === 'string' ? body.error : `http-${status}`
    return { ok: false, error: reason }
  }

  const body = data as {
    token?: string
    leaseToken?: string
    featureSet?: Array<string>
    license?: HubLicenseSnapshot
    account?: HubState['account']
    enterprise?: {
      modelAllowlist?: Array<string>
      provider?: string
      apiKey?: string
      apiKeyEnv?: string
    }
  }
  if (!body.token || !body.leaseToken || !body.license) {
    return { ok: false, error: 'invalid-hub-response' }
  }

  writeHubConfig(config)
  const now = Date.now()
  // 企业统一下发：API Key 直接写入 ~/.hermes/.env（用户零配置）
  const enterpriseRaw = body.enterprise
  const enterprise =
    enterpriseRaw && Array.isArray(enterpriseRaw.modelAllowlist)
      ? {
          modelAllowlist: enterpriseRaw.modelAllowlist,
          ...(typeof enterpriseRaw.provider === 'string'
            ? { provider: enterpriseRaw.provider }
            : {}),
          ...(typeof enterpriseRaw.apiKey === 'string' &&
          typeof enterpriseRaw.apiKeyEnv === 'string'
            ? {
                apiKey: enterpriseRaw.apiKey,
                apiKeyEnv: enterpriseRaw.apiKeyEnv,
              }
            : {}),
        }
      : null
  if (enterprise?.apiKey && enterprise.apiKeyEnv) {
    writeEnvValue(getHermesEnvPath(), enterprise.apiKeyEnv, enterprise.apiKey)
    console.log(
      `[hub] 企业 API Key 已写入 ${enterprise.apiKeyEnv}（用户零配置）`,
    )
  }
  const state: HubState = {
    baseUrl,
    tenantId,
    email,
    deviceId,
    token: body.token,
    leaseToken: body.leaseToken,
    featureSet: Array.isArray(body.featureSet) ? body.featureSet : [],
    license: body.license ?? null,
    account: body.account ?? null,
    enterprise,
    connectedAt: now,
    lastHeartbeatAt: now,
    lastError: null,
    disconnectedAt: null,
  }
  writeHubState(state)
  ensureTicker()
  return { ok: true, status: hubStatus() }
}

/** Disconnect from the hub: clear session state and config, stop timers (seats are released automatically via the hub heartbeat TTL) */
export function disconnectHub(): void {
  stopTicker()
  clearHubState()
  clearHubConfig()
}

// ─── Heartbeat / status ────────────────────────────────────────────────────

/**
 * Renew the floating seat lease with the hub. Any failure marks disconnectedAt
 * (network down / 401 / seat lost); the next successful heartbeat recovers, and
 * backfill is suspended meanwhile.
 */
export async function runHubHeartbeat(): Promise<boolean> {
  const state = readHubState()
  if (!state) return false
  try {
    const { status } = await hubRequest(state, '/api/auth/desktop/heartbeat', {
      leaseToken: state.leaseToken,
    }, false)
    if (status === 200) {
      state.lastHeartbeatAt = Date.now()
      state.disconnectedAt = null
      state.lastError = null
      writeHubState(state)
      return true
    }
    state.disconnectedAt = Date.now()
    state.lastError = status === 404 ? 'lease-not-found' : `heartbeat-http-${status}`
    writeHubState(state)
    return false
  } catch {
    state.disconnectedAt = Date.now()
    state.lastError = 'hub-unreachable'
    writeHubState(state)
    return false
  }
}

/** Current connection status (including outbox depth and license hard-deadline check) */
export function hubStatus(now = Date.now()): HubStatus {
  const config = readHubConfig()
  const state = readHubState()
  const license = state?.license ?? null
  return {
    configured: config !== null,
    connected: state !== null && state.disconnectedAt === null,
    baseUrl: state?.baseUrl ?? config?.baseUrl ?? '',
    tenantId: state?.tenantId ?? config?.tenantId ?? '',
    email: state?.email ?? config?.email ?? '',
    deviceId: state?.deviceId ?? config?.deviceId ?? '',
    featureSet: state?.featureSet ?? [],
    license,
    licenseExpired: license !== null && now > license.hardDeadline,
    inGrace: license !== null && now > license.expiresAt && now <= license.hardDeadline,
    lastHeartbeatAt: state?.lastHeartbeatAt ?? null,
    disconnectedAt: state?.disconnectedAt ?? null,
    lastError: state?.lastError ?? null,
    outboxDepth: outboxDepth(),
    enterprise: state?.enterprise ?? null,
  }
}

/**
 * Desktop login gate: when the hub is configured and a local license snapshot is held,
 * deny local login past the hard deadline (expiresAt + graceDays) since validity is
 * controlled by the hub; when no hub is configured / offline state is unknown, always
 * allow (offline local usability).
 */
export function hubLoginGate(now = Date.now()): { ok: true } | { ok: false; reason: string } {
  if (!readHubConfig()) return { ok: true }
  const state = readHubState()
  if (!state?.license) return { ok: true }
  if (now > state.license.hardDeadline) return { ok: false, reason: 'license-expired' }
  return { ok: true }
}

// ─── Event reporting / offline backfill ────────────────────────────────────

/**
 * Report an event (called by lineage forwarding): always enqueue into the outbox first
 * (assigning a monotonic device-local seq), then asynchronously attempt to flush. No-op
 * when the hub is not connected.
 */
export function enqueueHubEvent(input: HubEventInput): number | null {
  if (!readHubConfig()) return null
  const seq = enqueueEvent(input)
  if (seq !== null) void flushHubOutbox()
  return seq
}

let flushing = false

/**
 * Flush the outbox: while online, report events one by one in seq order; successful or
 * idempotent-duplicate events are dequeued; failure stops the flush (order preserved).
 * Multi-round draining: events enqueued during a round's snapshot are handled by the next
 * round, until the queue is empty or a failure occurs.
 */
export async function flushHubOutbox(): Promise<{ sent: number; failed: boolean }> {
  if (flushing) return { sent: 0, failed: false }
  const state = readHubState()
  if (!state || state.disconnectedAt !== null) return { sent: 0, failed: false }

  flushing = true
  let sent = 0
  let failed = false
  try {
    for (let round = 0; round < 50 && !failed; round++) {
      const rows = listOutbox()
      if (rows.length === 0) break
      for (const row of rows) {
        const { status } = await hubRequest(state, '/api/events', {
          type: row.event_type,
          deviceId: state.deviceId,
          seq: row.seq,
          taskId: row.task_id,
          runId: row.run_id,
          ownerId: row.owner_id,
          payload: JSON.parse(row.payload) as Record<string, unknown>,
        }, true)

        if (status === 201 || status === 200) {
          deleteOutboxRows([row.seq])
          sent += 1
          continue
        }
        if (status === 401) {
          state.disconnectedAt = Date.now()
          state.lastError = 'unauthorized'
          writeHubState(state)
          failed = true
          break
        }
        if (status === 403) {
          state.disconnectedAt = Date.now()
          state.lastError = 'license-expired'
          writeHubState(state)
          failed = true
          break
        }
        // 503 / network error / other → stop sending in order, retry on the next flush
        failed = true
        break
      }
    }
  } catch {
    failed = true
  } finally {
    flushing = false
  }
  return { sent, failed }
}

// ─── Timers ────────────────────────────────────────────────────────────────

let _heartbeatTimer: ReturnType<typeof setInterval> | null = null
let _flushTimer: ReturnType<typeof setInterval> | null = null

/** Start the heartbeat/backfill timers (idempotent; unref does not block process exit) */
function ensureTicker(): void {
  if (_heartbeatTimer) return
  _heartbeatTimer = setInterval(() => {
    void runHubHeartbeat()
  }, HEARTBEAT_INTERVAL_MS)
  _heartbeatTimer.unref()
  _flushTimer = setInterval(() => {
    void flushHubOutbox()
  }, FLUSH_INTERVAL_MS)
  _flushTimer.unref()
}

function stopTicker(): void {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer)
    _heartbeatTimer = null
  }
  if (_flushTimer) {
    clearInterval(_flushTimer)
    _flushTimer = null
  }
}
