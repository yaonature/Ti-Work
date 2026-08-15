import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { json } from '@tanstack/react-start'
import { createFileRoute } from '@tanstack/react-router'
import { isAuthenticated } from '../../server/auth-middleware'
import { getEnvConfiguredModels, getHermesHome } from '../../server/env-models'
import {
  ensureGatewayProbed,
  getGatewayCapabilities,
} from '../../server/hermes-api'
import { getHermesApiToken } from '../../server/gateway-capabilities'

const HERMES_API_URL = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'

// Well-known models for providers available via auth store
const AUTH_STORE_MODELS: Record<string, Array<ModelEntry>> = {
  anthropic: [
    {
      id: 'claude-sonnet-4-20250514',
      name: 'Claude Sonnet 4',
      provider: 'anthropic-billing-proxy',
    },
    {
      id: 'claude-opus-4-20250514',
      name: 'Claude Opus 4',
      provider: 'anthropic-billing-proxy',
    },
  ],
  openai: [{ id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }],
  xai: [{ id: 'grok-3', name: 'Grok 3', provider: 'xai' }],
}

/**
 * 兜底模型：读取 ~/.hermes/.env 中已配置 Key 的 API Key 型服务商（DeepSeek/通义千问等）。
 * 网关不可达或 /v1/models 未列出时，模型选择器仍能看到可用模型。
 */

function getAuthStoreModels(): Array<ModelEntry> {
  const extra: Array<ModelEntry> = []
  for (const storePath of [
    path.join(getHermesHome(), 'auth-profiles.json'),
    path.join(
      os.homedir(),
      '.openclaw',
      'agents',
      'main',
      'agent',
      'auth-profiles.json',
    ),
  ]) {
    try {
      if (!fs.existsSync(storePath)) continue
      const store = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
      const profiles = store?.profiles || {}
      const seen = new Set<string>()
      for (const key of Object.keys(profiles)) {
        const providerId = key.split(':')[0]
        if (seen.has(providerId)) continue
        const p = profiles[key]
        const token = String(p?.token || p?.key || p?.access || '').trim()
        if (!token) continue
        seen.add(providerId)
        const models = AUTH_STORE_MODELS[providerId]
        if (models) extra.push(...models)
      }
      if (extra.length > 0) break // Use first store that has data
    } catch {}
  }
  return extra
}

type ModelEntry = {
  provider?: string
  id?: string
  name?: string
  [key: string]: unknown
}

function buildConfiguredProviders(models: Array<ModelEntry>): Array<string> {
  return Array.from(
    new Set(
      models
        .map((model) =>
          typeof model.provider === 'string' ? model.provider : '',
        )
        .filter(Boolean),
    ),
  )
}

function buildFallbackModelsResponse(
  envModels: Array<ModelEntry>,
  authModels: Array<ModelEntry> = [],
  source: 'configured-providers' | 'unavailable' = 'configured-providers',
): {
  ok: true
  object: 'list'
  data: Array<ModelEntry>
  models: Array<ModelEntry>
  configuredProviders: Array<string>
  source: 'configured-providers' | 'unavailable'
  message?: string
} {
  const models = [...envModels]
  const existingIds = new Set(models.map((model) => model.id))
  for (const model of authModels) {
    if (!existingIds.has(model.id)) models.push(model)
  }
  const configuredProviders = buildConfiguredProviders(models)
  return {
    ok: true,
    object: 'list',
    data: models,
    models,
    configuredProviders,
    source: models.length > 0 ? source : 'unavailable',
    ...(models.length === 0
      ? { message: '无法获取模型列表：网关不可达，且未检测到已配置的模型服务商。' }
      : {}),
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>
  return {}
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHermesModel(entry: unknown): ModelEntry | null {
  if (typeof entry === 'string') {
    const id = entry.trim()
    if (!id) return null
    return {
      id,
      name: id,
      provider: id.includes('/') ? id.split('/')[0] : 'hermes-agent',
    }
  }
  const record = asRecord(entry)
  const id =
    readString(record.id) || readString(record.name) || readString(record.model)
  if (!id) return null
  return {
    ...record,
    id,
    name:
      readString(record.name) ||
      readString(record.display_name) ||
      readString(record.label) ||
      id,
    provider:
      readString(record.provider) ||
      readString(record.owned_by) ||
      (id.includes('/') ? id.split('/')[0] : 'hermes-agent'),
  }
}

async function fetchHermesModels(): Promise<Array<ModelEntry>> {
  const token = getHermesApiToken()
  const response = await fetch(`${HERMES_API_URL}/v1/models`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok)
    throw new Error(`Hermes models request failed (${response.status})`)
  const payload = asRecord(await response.json())
  const rawModels = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : []
  return rawModels
    .map(normalizeHermesModel)
    .filter((e): e is ModelEntry => e !== null)
}

export const Route = createFileRoute('/api/models')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        // 兜底：env 中已配置 Key 的服务商模型（网关离线/未列出时仍可用）
        const envModels = getEnvConfiguredModels()
        const authModels = getAuthStoreModels()
        if (!getGatewayCapabilities().models) {
          return json(buildFallbackModelsResponse(envModels, authModels))
        }
        try {
          const models = await fetchHermesModels()
          // Add models from auth store providers (Anthropic, OpenAI, etc.)
          const existingIds = new Set(models.map((m) => m.id))
          for (const m of [...authModels, ...envModels]) {
            if (!existingIds.has(m.id)) {
              models.push(m)
            }
          }
          const configuredProviders = buildConfiguredProviders(models)
          return json({
            ok: true,
            object: 'list',
            data: models,
            models,
            configuredProviders,
          })
        } catch (err) {
          return json(
            buildFallbackModelsResponse(envModels, authModels),
            { status: 200 },
          )
        }
      },
    },
  },
})
