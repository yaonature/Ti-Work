/**
 * G8 desktop hub connection — hub connection config and session state persistence.
 *
 * Two pieces of data are managed separately:
 *  - Config (user-editable): the `tiWork.hub` section of `~/.hermes/config.yaml`
 *    (baseUrl / tenantId / email / deviceId), sharing the same file as the existing
 *    hermes-config.
 *  - Session state (machine-managed): `~/.hermes/ti-work-hub-state.json` (0600),
 *    storing the hub-issued token / leaseToken / featureSet / license snapshot,
 *    used for offline fallback (offline local usability + hard-deadline gate) and
 *    event backfill.
 *
 * Test isolation: paths can be overridden with TI_WORK_HUB_CONFIG_PATH / TI_WORK_HUB_STATE_PATH.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'
import YAML from 'yaml'

const HERMES_HOME = path.join(os.homedir(), '.hermes')
const configPath = () =>
  process.env.TI_WORK_HUB_CONFIG_PATH ?? path.join(HERMES_HOME, 'config.yaml')
const statePath = () =>
  process.env.TI_WORK_HUB_STATE_PATH ?? path.join(HERMES_HOME, 'ti-work-hub-state.json')

export interface HubLicenseSnapshot {
  edition: string
  expiresAt: number
  /** Hard deadline = expiresAt + graceDays (issued by the hub) */
  hardDeadline: number
  inGrace: boolean
  seats: number
  activeSeats: number
}

export interface HubAccountSnapshot {
  id: string
  tenantId: string
  email: string
  displayName: string
  role: string
}

/** Hub connection config (user-editable, persisted in config.yaml) */
export interface HubConfig {
  baseUrl: string
  tenantId: string
  email: string
  deviceId: string
}

/** 企业统一下发配置（登录时由 hub 下发，用户零配置） */
export interface EnterpriseConfig {
  /** 模型白名单：非空时仅白名单内模型可用（企业模型管控） */
  modelAllowlist: Array<string>
  /** 企业统一 provider（如 deepseek）；用户无需自行配置 */
  provider?: string
  /** 企业统一 API Key（登录时写入 ~/.hermes/.env，用户零配置） */
  apiKey?: string
  apiKeyEnv?: string
}

/** Session state (machine-managed, persisted in the state file) */
export interface HubState {
  baseUrl: string
  tenantId: string
  email: string
  deviceId: string
  token: string
  leaseToken: string
  featureSet: Array<string>
  license: HubLicenseSnapshot | null
  account: HubAccountSnapshot | null
  enterprise: EnterpriseConfig | null
  connectedAt: number
  lastHeartbeatAt: number
  lastError: string | null
  /** Time the connection dropped due to heartbeat/report failures (null = online) */
  disconnectedAt: number | null
}

/** Read hub config from config.yaml; returns null when missing/unconfigured */
export function readHubConfig(): HubConfig | null {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8')
    const doc = YAML.parse(raw) as Record<string, unknown> | null
    const hub = doc?.tiWork as Record<string, unknown> | undefined
    const hubCfg = hub?.hub as Record<string, unknown> | undefined
    if (!hubCfg) return null
    const baseUrl = typeof hubCfg.baseUrl === 'string' ? hubCfg.baseUrl.trim() : ''
    const tenantId = typeof hubCfg.tenantId === 'string' ? hubCfg.tenantId.trim() : ''
    const email = typeof hubCfg.email === 'string' ? hubCfg.email.trim() : ''
    const deviceId = typeof hubCfg.deviceId === 'string' ? hubCfg.deviceId.trim() : ''
    if (!baseUrl || !tenantId || !email) return null
    return { baseUrl, tenantId, email, deviceId }
  } catch {
    return null
  }
}

/** Write hub config (deep-merged into config.yaml, preserving the rest of the content) */
export function writeHubConfig(config: HubConfig): void {
  let doc: Record<string, unknown> = {}
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8')
    const parsed = YAML.parse(raw) as Record<string, unknown> | null
    if (parsed && typeof parsed === 'object') doc = parsed
  } catch {
    // File missing or corrupt → rebuild from an empty document
  }
  const tiWork = (doc.tiWork as Record<string, unknown>) ?? {}
  tiWork.hub = { ...config }
  doc.tiWork = tiWork
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), YAML.stringify(doc), 'utf-8')
}

/** Clear the hub config section (preserving the rest of the file) */
export function clearHubConfig(): void {
  try {
    const raw = fs.readFileSync(configPath(), 'utf-8')
    const doc = YAML.parse(raw) as Record<string, unknown> | null
    if (!doc || typeof doc !== 'object') return
    const tiWork = doc.tiWork as Record<string, unknown> | undefined
    if (tiWork && typeof tiWork === 'object') {
      delete tiWork.hub
      if (Object.keys(tiWork).length === 0) delete doc.tiWork
    }
    fs.writeFileSync(configPath(), YAML.stringify(doc), 'utf-8')
  } catch {
    // File missing → nothing to do
  }
}

/** Read session state; returns null when no state file exists */
export function readHubState(): HubState | null {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    return JSON.parse(raw) as HubState
  } catch {
    return null
  }
}

/** Write session state (0600; contains sensitive credentials like token/leaseToken) */
export function writeHubState(state: HubState): void {
  fs.mkdirSync(path.dirname(statePath()), { recursive: true })
  fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  })
}

/** Clear session state (called when disconnecting) */
export function clearHubState(): void {
  try {
    fs.unlinkSync(statePath())
  } catch {
    // Already gone is fine
  }
}

/** Generate a new device ID (persisted into config by hub-client on connect) */
export function generateDeviceId(): string {
  return `dev-${randomUUID().replaceAll('-', '').slice(0, 16)}`
}
