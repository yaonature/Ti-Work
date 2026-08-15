/**
 * G6 integration config store — pure logic (unit-testable in a node environment).
 *
 * Reads/writes the `integrations` section of ~/.hermes/config.yaml (Feishu/DingTalk webhook config).
 * File IO is injected via explicit paths; config object operations have no side effects.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import YAML from 'yaml'

export type IntegrationChannel = 'feishu' | 'dingtalk'

export interface ChannelSettings {
  enabled: boolean
  webhookUrl: string
  secret: string
}

export interface ChannelState {
  configured: boolean
  enabled: boolean
  secretSet: boolean
  secretMasked: string
  webhookUrlMasked: string
}

/** Top-level section in config.yaml that holds integration config */
export const INTEGRATIONS_CONFIG_KEY = 'integrations'

/**
 * Resolve the config.yaml path: HERMES_HOME env can override it (e.g. isolated e2e scenarios),
 * defaulting to ~/.hermes/config.yaml. All G6 routes use this function to keep paths consistent.
 */
export function getConfigPath(): string {
  return join(
    process.env.HERMES_HOME || join(homedir(), '.hermes'),
    'config.yaml',
  )
}

/** Extract settings for a single channel; returns null when unconfigured or malformed */
export function getChannelSettings(
  config: Record<string, unknown>,
  channel: IntegrationChannel,
): ChannelSettings | null {
  const integrations = config[INTEGRATIONS_CONFIG_KEY]
  if (!integrations || typeof integrations !== 'object') return null
  const raw = (integrations as Record<string, unknown>)[channel]
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  return {
    enabled: entry.enabled === true,
    webhookUrl: typeof entry.webhook_url === 'string' ? entry.webhook_url : '',
    secret: typeof entry.secret === 'string' ? entry.secret : '',
  }
}

/**
 * Write/update/delete settings for a channel, returning a new (immutable) config object.
 * When value is null, the channel section is deleted.
 */
export function setChannelSettings(
  config: Record<string, unknown>,
  channel: IntegrationChannel,
  value: ChannelSettings | null,
): Record<string, unknown> {
  const integrations: Record<string, unknown> = {
    ...((config[INTEGRATIONS_CONFIG_KEY] as Record<string, unknown> | undefined) ??
      {}),
  }
  if (value === null) {
    delete integrations[channel]
  } else {
    integrations[channel] = {
      enabled: value.enabled,
      webhook_url: value.webhookUrl,
      secret: value.secret,
    }
  }
  return { ...config, [INTEGRATIONS_CONFIG_KEY]: integrations }
}

/** Secret masking: keep the first/last 4 chars of long secrets, ellipsize the rest with ...; mask short secrets entirely */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return '***'
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`
}

/** URL masking: keep the protocol and path prefix, keep the last 4 chars of the token */
export function maskUrl(url: string): string {
  const slashIdx = url.lastIndexOf('/')
  if (slashIdx < 0) return '***'
  const head = url.slice(0, slashIdx + 1)
  const tail = url.slice(slashIdx + 1)
  if (tail.length <= 4) return `${head}***`
  return `${head}***${tail.slice(-4)}`
}

/** Webhook URL normalization: strip leading/trailing whitespace */
export function normalizeWebhookUrl(raw: string): string {
  return raw.trim()
}

/** Convert to a state displayable by the frontend (including masked values) */
export function toChannelState(
  settings: ChannelSettings | null,
): ChannelState {
  if (!settings) {
    return {
      configured: false,
      enabled: false,
      secretSet: false,
      secretMasked: '***',
      webhookUrlMasked: '',
    }
  }
  return {
    configured: settings.webhookUrl.length > 0,
    enabled: settings.enabled,
    secretSet: settings.secret.length > 0,
    secretMasked: maskSecret(settings.secret),
    webhookUrlMasked: settings.webhookUrl ? maskUrl(settings.webhookUrl) : '',
  }
}

/** Read config.yaml; returns an empty object when the file is missing or fails to parse */
export function readConfigFile(configPath: string): Record<string, unknown> {
  try {
    const raw = readFileSync(configPath, 'utf-8')
    return (YAML.parse(raw) as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

/** Atomically write config.yaml: write to a temp file first, then rename, to avoid partial files */
export function writeConfigFile(
  configPath: string,
  config: Record<string, unknown>,
): void {
  mkdirSync(dirname(configPath), { recursive: true })
  const tmpPath = `${configPath}.tmp-${process.pid}`
  writeFileSync(tmpPath, YAML.stringify(config), 'utf-8')
  renameSync(tmpPath, configPath)
}
