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

/**
 * 飞书自建应用（企业自建应用）授权配置。
 * 与 webhook 配置共用 `integrations.feishu` 段（webhook 字段 + app_* 字段共存）。
 * appToken 为验证时换到的 tenant_access_token，供网关后续调用飞书开放平台。
 */
export interface FeishuAppSettings {
  appId: string
  appSecret: string
  appToken: string
  appVerified: boolean
}

/** 前端可展示的飞书自建应用授权状态（appSecret 以掩码呈现，appId 为非敏感字段不掩码） */
export interface FeishuAppState {
  configured: boolean
  verified: boolean
  appId: string
  appSecretSet: boolean
  appSecretMasked: string
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
 * Extract Feishu self-built app authorization settings from `integrations.feishu`.
 * Returns null when the section is missing/malformed or no app credentials are stored.
 */
export function getFeishuAppSettings(
  config: Record<string, unknown>,
): FeishuAppSettings | null {
  const integrations = config[INTEGRATIONS_CONFIG_KEY]
  if (!integrations || typeof integrations !== 'object') return null
  const raw = (integrations as Record<string, unknown>).feishu
  if (!raw || typeof raw !== 'object') return null
  const entry = raw as Record<string, unknown>
  const appId = typeof entry.app_id === 'string' ? entry.app_id : ''
  const appSecret = typeof entry.app_secret === 'string' ? entry.app_secret : ''
  const appToken = typeof entry.app_token === 'string' ? entry.app_token : ''
  const appVerified = entry.app_verified === true
  if (!appId && !appSecret) return null
  return { appId, appSecret, appToken, appVerified }
}

/**
 * Write/update/clear Feishu self-built app authorization, returning a new (immutable) config
 * object. Merges app_* fields into the existing `integrations.feishu` section, keeping the
 * webhook fields intact. When value is null, the app_* fields are removed while preserving
 * webhook config.
 */
export function setFeishuAppSettings(
  config: Record<string, unknown>,
  value: FeishuAppSettings | null,
): Record<string, unknown> {
  const integrations: Record<string, unknown> = {
    ...((config[INTEGRATIONS_CONFIG_KEY] as Record<string, unknown> | undefined) ??
      {}),
  }
  const existing =
    (integrations.feishu as Record<string, unknown> | undefined) ?? {}
  if (value === null) {
    const {
      app_id: _appId,
      app_secret: _appSecret,
      app_token: _appToken,
      app_verified: _appVerified,
      ...rest
    } = existing
    if (Object.keys(rest).length > 0) {
      integrations.feishu = rest
    } else {
      delete integrations.feishu
    }
  } else {
    integrations.feishu = {
      ...existing,
      app_id: value.appId,
      app_secret: value.appSecret,
      app_token: value.appToken,
      app_verified: value.appVerified,
    }
  }
  return { ...config, [INTEGRATIONS_CONFIG_KEY]: integrations }
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
    // 覆盖 webhook 配置时，保留该通道已保存的自建应用字段，避免互相覆盖
    const existing =
      (integrations[channel] as Record<string, unknown> | undefined) ?? {}
    integrations[channel] = {
      enabled: value.enabled,
      webhook_url: value.webhookUrl,
      secret: value.secret,
      ...(existing.app_id !== undefined && { app_id: existing.app_id }),
      ...(existing.app_secret !== undefined && {
        app_secret: existing.app_secret,
      }),
      ...(existing.app_token !== undefined && { app_token: existing.app_token }),
      ...(existing.app_verified !== undefined && {
        app_verified: existing.app_verified,
      }),
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

/** Convert Feishu app authorization settings to a frontend-displayable state */
export function toFeishuAppState(
  settings: FeishuAppSettings | null,
): FeishuAppState {
  if (!settings) {
    return {
      configured: false,
      verified: false,
      appId: '',
      appSecretSet: false,
      appSecretMasked: '***',
    }
  }
  return {
    configured: settings.appId.length > 0,
    verified: settings.appVerified,
    appId: settings.appId,
    appSecretSet: settings.appSecret.length > 0,
    appSecretMasked: maskSecret(settings.appSecret),
  }
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
