import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit01Icon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { ProviderIcon } from './components/provider-icon'
import { ProviderWizard } from './components/provider-wizard'
import type { ModelCatalogEntry } from '@/lib/model-types'
import type { ProviderSummaryForEdit } from './components/provider-wizard'
import BackendUnavailableState from '@/components/backend-unavailable-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toast'
import { getUnavailableReason } from '@/lib/feature-gates'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import {
  getProviderDisplayName,
  getProviderInfo,
  normalizeProviderId,
} from '@/lib/provider-catalog'
import { cn } from '@/lib/utils'

/**
 * Strip the provider prefix that hermes-agent adds internally via litellm.
 * e.g. "openrouter/nvidia/nemotron-..." → "nvidia/nemotron-..."
 *      "anthropic/claude-3-5-sonnet"    → "claude-3-5-sonnet"
 * Only strips the first path segment if it matches a known provider ID.
 */
const KNOWN_PROVIDER_PREFIXES = [
  'openrouter',
  'anthropic',
  'openai',
  'openai-codex',
  'nous',
  'ollama',
  'zai',
  'kimi-coding',
  'minimax',
  'minimax-cn',
  'deepseek',
  'dashscope',
]

function stripProviderPrefix(model: string): string {
  if (!model) return model
  const slash = model.indexOf('/')
  if (slash === -1) return model
  const prefix = model.slice(0, slash)
  if (KNOWN_PROVIDER_PREFIXES.includes(prefix)) {
    return model.slice(slash + 1)
  }
  return model
}

type ProviderStatus = 'active' | 'configured'
type SettingsTabId = 'providers' | 'models' | 'agents' | 'session' | 'memory'
type SettingKind = 'text' | 'number' | 'select' | 'boolean' | 'multiline'

type ProviderSummary = {
  id: string
  name: string
  description: string
  modelCount: number
  status: ProviderStatus
}

type ProvidersScreenProps = {
  embedded?: boolean
}

type HermesConfig = Record<string, unknown>

type ConfigQueryResponse = {
  ok?: boolean
  payload?: HermesConfig
  error?: string
}

type ConfigPatchResponse = {
  ok?: boolean
  error?: string
}

type SelectOption = {
  label: string
  value: string
}

type SettingDefinition = {
  id: string
  tab: SettingsTabId
  label: string
  description: string
  path?: string
  kind: SettingKind
  options?: Array<SelectOption>
  placeholder?: string
  min?: number
  step?: number
  rows?: number
  unsupported?: boolean
  formatter?: (value: unknown) => string
  parser?: (value: string) => unknown
}

type SaveSettingPayload = {
  path: string
  value: unknown
  label: string
}

const HERMES_API_URL = process.env.HERMES_API_URL || 'http://127.0.0.1:8642'

type HermesCatalogEntry =
  | string
  | {
      id: string
      provider: string
      name: string
      [key: string]: unknown
    }

function isHermesCatalogEntry(
  entry: HermesCatalogEntry | null,
): entry is HermesCatalogEntry {
  return entry !== null
}

async function fetchModels(): Promise<{
  ok?: boolean
  models?: Array<ModelCatalogEntry>
  configuredProviders?: Array<string>
}> {
  const response = await fetch(`${HERMES_API_URL}/v1/models`)
  if (!response.ok) {
    throw new Error(`Hermes models request failed (${response.status})`)
  }

  const payload = (await response.json()) as
    | Array<unknown>
    | {
        data?: Array<Record<string, unknown>>
        models?: Array<Record<string, unknown>>
      }
  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.models)
        ? payload.models
        : []

  const models = rawModels
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const id =
        typeof record.id === 'string'
          ? record.id.trim()
          : typeof record.name === 'string'
            ? record.name.trim()
            : typeof record.model === 'string'
              ? record.model.trim()
              : ''
      if (!id) return null
      const provider =
        typeof record.provider === 'string' && record.provider.trim()
          ? record.provider.trim()
          : typeof record.owned_by === 'string' && record.owned_by.trim()
            ? record.owned_by.trim()
            : id.includes('/')
              ? id.split('/')[0]
              : 'hermes-agent'

      return {
        ...record,
        id,
        provider,
        name:
          typeof record.name === 'string' && record.name.trim()
            ? record.name.trim()
            : typeof record.display_name === 'string' &&
                record.display_name.trim()
              ? record.display_name.trim()
              : typeof record.label === 'string' && record.label.trim()
                ? record.label.trim()
                : id,
      }
    })
    .filter(isHermesCatalogEntry)

  const configuredProviders = Array.from(
    new Set(
      models.flatMap((entry) => {
        if (typeof entry === 'string') return []
        return typeof entry.provider === 'string' && entry.provider
          ? [entry.provider]
          : []
      }),
    ),
  )

  return {
    ok: true,
    models: models,
    configuredProviders,
  }
}

const TAB_ORDER: Array<{ id: SettingsTabId; label: string }> = [
  { id: 'providers', label: '服务提供方' },
  { id: 'models', label: '模型' },
  { id: 'agents', label: 'AI 与智能体' },
  { id: 'session', label: '会话' },
  { id: 'memory', label: '记忆' },
]

const MEMORY_PROVIDER_OPTIONS: Array<SelectOption> = [
  { label: '本地', value: 'local' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Gemini', value: 'gemini' },
  { label: 'Voyage', value: 'voyage' },
  { label: 'Mistral', value: 'mistral' },
  { label: 'Ollama', value: 'ollama' },
]

const MEMORY_FALLBACK_OPTIONS: Array<SelectOption> = [
  { label: '无', value: 'none' },
  ...MEMORY_PROVIDER_OPTIONS,
]

const SETTINGS: Array<SettingDefinition> = [
  {
    id: 'primary-model',
    tab: 'models',
    path: 'agents.defaults.model.primary',
    label: '默认模型',
    description:
      '新智能体默认使用的主要模型，除非为特定智能体单独指定。',
    kind: 'text',
    placeholder: 'provider/model',
  },
  {
    id: 'fallback-chain',
    tab: 'models',
    path: 'agents.defaults.model.fallbacks',
    label: '回退链',
    description:
      '按顺序排列的回退模型，每行一个或用逗号分隔。',
    kind: 'multiline',
    rows: 3,
    placeholder: 'anthropic-oauth/claude-sonnet-4-6',
    formatter: formatStringList,
    parser: parseStringList,
  },
  {
    id: 'context-tokens-models',
    tab: 'models',
    path: 'agents.defaults.contextTokens',
    label: '上下文 Token',
    description:
      '在无更细粒度覆盖时应用于智能体的默认上下文 Token 预算。',
    kind: 'number',
    min: 1,
    step: 1000,
  },
  // Thinking/reasoning settings removed — not supported by Hermes Agent
  // Legacy settings removed: bootstrap, block streaming,
  // compaction, thinking, verbose, and fast mode do not apply here.
  {
    id: 'context-tokens-session',
    tab: 'session',
    path: 'agents.defaults.contextTokens',
    label: '会话上下文 Token',
    description:
      '与智能体默认上下文预算保持同步，并显示在会话配置流程中。',
    kind: 'number',
    min: 1,
    step: 1000,
  },
  {
    id: 'memory-provider',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.provider',
    label: '记忆搜索服务提供方',
    description: '用于记忆搜索和整合的向量嵌入服务提供方。',
    kind: 'select',
    options: MEMORY_PROVIDER_OPTIONS,
  },
  {
    id: 'memory-fallback',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.fallback',
    label: '记忆回退服务提供方',
    description:
      '当主要记忆搜索服务提供方不可用时使用的回退服务提供方。',
    kind: 'select',
    options: MEMORY_FALLBACK_OPTIONS,
  },
  {
    id: 'memory-sync-on-session-start',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.onSessionStart',
    label: '会话开始时同步',
    description: '新会话开始时刷新已索引的记忆路径。',
    kind: 'boolean',
  },
  {
    id: 'memory-sync-on-search',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.onSearch',
    label: '搜索前同步',
    description: '在执行记忆搜索查询前运行同步。',
    kind: 'boolean',
  },
  {
    id: 'memory-sync-interval',
    tab: 'memory',
    path: 'agents.defaults.memorySearch.sync.intervalMinutes',
    label: '整合间隔',
    description: '后台记忆整合运行之间的间隔（分钟）。',
    kind: 'number',
    min: 0,
    step: 5,
  },
]

function formatStringList(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

function parseStringList(value: string): Array<string> {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readProviderId(entry: ModelCatalogEntry): string | null {
  if (typeof entry === 'string') return null
  const provider = typeof entry.provider === 'string' ? entry.provider : ''
  const normalized = normalizeProviderId(provider)
  return normalized || null
}

function buildProviderSummaries(payload: {
  models?: Array<ModelCatalogEntry>
  configuredProviders?: Array<string>
}): Array<ProviderSummary> {
  const modelCounts = new Map<string, number>()

  for (const entry of payload.models ?? []) {
    const providerId = readProviderId(entry)
    if (!providerId) continue

    const current = modelCounts.get(providerId) ?? 0
    modelCounts.set(providerId, current + 1)
  }

  const configuredSet = new Set<string>()
  for (const providerId of payload.configuredProviders ?? []) {
    const normalized = normalizeProviderId(providerId)
    if (normalized) configuredSet.add(normalized)
  }

  for (const providerId of modelCounts.keys()) {
    configuredSet.add(providerId)
  }

  const summaries: Array<ProviderSummary> = []

  for (const providerId of configuredSet) {
    const metadata = getProviderInfo(providerId)
    const modelCount = modelCounts.get(providerId) ?? 0

    summaries.push({
      id: providerId,
      name: getProviderDisplayName(providerId),
      description:
        metadata?.description ||
        '已在本地 Hermes 环境中配置的服务提供方。',
      modelCount,
      status: modelCount > 0 ? 'active' : 'configured',
    })
  }

  summaries.sort(function sortByName(a, b) {
    return a.name.localeCompare(b.name)
  })

  return summaries
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[segment]
  }, source)
}

function coerceBoolean(value: unknown): boolean {
  return value === true
}

function coerceString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function coerceNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : ''
}

function defaultFormatValue(
  setting: SettingDefinition,
  value: unknown,
): string {
  if (setting.kind === 'number') return coerceNumber(value)
  if (setting.kind === 'boolean') return coerceBoolean(value) ? 'true' : 'false'
  return coerceString(value)
}

function getDraftValue(
  setting: SettingDefinition,
  config: HermesConfig | undefined,
  draftValues: Record<string, string>,
): string {
  if (draftValues[setting.id] !== undefined) return draftValues[setting.id]
  if (!setting.path) return ''
  const rawValue = readPath(config, setting.path)
  if (setting.formatter) return setting.formatter(rawValue)
  return defaultFormatValue(setting, rawValue)
}

function parseTextValue(setting: SettingDefinition, rawValue: string): unknown {
  if (setting.parser) return setting.parser(rawValue)
  return rawValue.trim()
}

function parseNumberValue(rawValue: string): number | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function buildModelOptions(
  models: Array<ModelCatalogEntry>,
): Array<SelectOption> {
  const seen = new Set<string>()
  const options: Array<SelectOption> = []

  for (const entry of models) {
    const modelId =
      typeof entry === 'string'
        ? entry
        : typeof entry.id === 'string'
          ? entry.id
          : typeof entry.alias === 'string'
            ? entry.alias
            : typeof entry.model === 'string'
              ? entry.model
              : ''

    if (!modelId.trim() || seen.has(modelId)) continue
    seen.add(modelId)

    const label =
      typeof entry === 'string'
        ? entry
        : typeof entry.displayName === 'string'
          ? entry.displayName
          : typeof entry.label === 'string'
            ? entry.label
            : typeof entry.name === 'string'
              ? entry.name
              : modelId

    options.push({ label, value: modelId })
  }

  options.sort(function sortOptions(a, b) {
    return a.label.localeCompare(b.label)
  })

  return options
}

function searchMatchesSetting(
  setting: SettingDefinition,
  query: string,
): boolean {
  const haystack = [
    setting.label,
    setting.description,
    setting.path,
    setting.tab,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--theme-border)] bg-[var(--theme-card)] px-2 py-0.5 text-xs font-medium text-[var(--theme-text)]">
      <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} strokeWidth={1.5} />
      {status === 'active' ? '已启用' : '已配置'}
    </span>
  )
}

function SettingCard(props: {
  setting: SettingDefinition
  config: HermesConfig | undefined
  draftValues: Record<string, string>
  setDraftValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  saveSetting: (payload: SaveSettingPayload) => Promise<void>
  isSaving: boolean
  savePath: string | null
  modelOptions: Array<SelectOption>
}) {
  const {
    setting,
    config,
    draftValues,
    setDraftValues,
    saveSetting,
    isSaving,
    savePath,
    modelOptions,
  } = props

  const disabled = setting.unsupported || isSaving
  const isActiveSave = Boolean(setting.path) && savePath === setting.path
  const draftValue = getDraftValue(setting, config, draftValues)
  const currentValue = setting.path ? readPath(config, setting.path) : undefined

  async function commit(rawValue: string) {
    if (!setting.path || setting.unsupported) return

    let nextValue: unknown = rawValue
    if (setting.kind === 'number') {
      nextValue = parseNumberValue(rawValue)
      if (nextValue === null) {
        toast(`请为${setting.label}输入有效数字`, { type: 'error' })
        return
      }
    } else if (setting.kind === 'multiline' || setting.kind === 'text') {
      nextValue = parseTextValue(setting, rawValue)
    }

    const currentSerialized = JSON.stringify(currentValue ?? null)
    const nextSerialized = JSON.stringify(nextValue ?? null)
    if (currentSerialized === nextSerialized) {
      setDraftValues((prev) => {
        const next = { ...prev }
        delete next[setting.id]
        return next
      })
      return
    }

    await saveSetting({
      path: setting.path,
      value: nextValue,
      label: setting.label,
    })

    setDraftValues((prev) => {
      const next = { ...prev }
      delete next[setting.id]
      return next
    })
  }

  return (
    <article className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--theme-text)]">
              {setting.label}
            </h3>
            {setting.unsupported ? (
              <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-[11px] font-medium text-[var(--theme-text)]">
                不可用
              </span>
            ) : null}
            {isActiveSave ? (
              <span className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--theme-text)]">
                保存中…
              </span>
            ) : null}
          </div>
          <p className="text-sm text-[var(--theme-muted)]">{setting.description}</p>
          {setting.path ? (
            <p className="text-xs text-[var(--theme-muted)]">{setting.path}</p>
          ) : null}
        </div>

        <div className="w-full md:max-w-[420px]">
          {setting.kind === 'boolean' ? (
            <div className="flex min-h-10 items-center justify-end">
              <Switch
                checked={coerceBoolean(currentValue)}
                disabled={disabled}
                aria-label={setting.label}
                onCheckedChange={(checked) => {
                  if (!setting.path || setting.unsupported) return
                  void saveSetting({
                    path: setting.path,
                    value: checked,
                    label: setting.label,
                  })
                }}
              />
            </div>
          ) : null}

          {setting.kind === 'select' ? (
            <select
              className="w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none"
              value={coerceString(currentValue)}
              disabled={disabled}
              onChange={(event) => {
                if (!setting.path || setting.unsupported) return
                void saveSetting({
                  path: setting.path,
                  value: event.target.value,
                  label: setting.label,
                })
              }}
            >
              <option value="">请选择…</option>
              {(setting.options ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : null}

          {setting.kind === 'text' ? (
            <>
              <Input
                value={draftValue}
                disabled={disabled}
                placeholder={setting.placeholder}
                list={
                  setting.id === 'primary-model'
                    ? 'settings-model-options'
                    : undefined
                }
                onChange={(event) => {
                  const nextValue = event.target.value
                  setDraftValues((prev) => ({
                    ...prev,
                    [setting.id]: nextValue,
                  }))
                }}
                onBlur={() => {
                  void commit(draftValue)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commit(draftValue)
                  }
                }}
              />
              {setting.id === 'primary-model' ? (
                <datalist id="settings-model-options">
                  {modelOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
              ) : null}
            </>
          ) : null}

          {setting.kind === 'number' ? (
            <Input
              type="number"
              value={draftValue}
              disabled={disabled}
              min={setting.min}
              step={setting.step}
              placeholder={setting.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value
                setDraftValues((prev) => ({
                  ...prev,
                  [setting.id]: nextValue,
                }))
              }}
              onBlur={() => {
                void commit(draftValue)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void commit(draftValue)
                }
              }}
            />
          ) : null}

          {setting.kind === 'multiline' ? (
            <textarea
              className="min-h-[88px] w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm text-[var(--theme-text)] outline-none placeholder:text-[var(--theme-muted)]"
              value={draftValue}
              disabled={disabled}
              rows={setting.rows ?? 4}
              placeholder={setting.placeholder}
              onChange={(event) => {
                const nextValue = event.target.value
                setDraftValues((prev) => ({
                  ...prev,
                  [setting.id]: nextValue,
                }))
              }}
              onBlur={() => {
                void commit(draftValue)
              }}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}

type ModelProviderOption =
  | 'custom'
  | 'openrouter'
  | 'anthropic'
  | 'openai'
  | 'deepseek'
  | 'dashscope'

type ModelConfigDraft = {
  provider: ModelProviderOption
  model: string
  baseUrl: string
}

type PerformanceDraft = {
  streamStaleTimeout: string
  streamReadTimeout: string
}

const MODEL_PROVIDER_OPTIONS: Array<SelectOption> = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问 Qwen（阿里云百炼）', value: 'dashscope' },
  { label: '自定义', value: 'custom' },
  { label: 'OpenRouter', value: 'openrouter' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'OpenAI', value: 'openai' },
]

const MODEL_PRESETS = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: 'deepseek' as const,
    model: 'deepseek-v4-flash',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'deepseek-pro',
    label: 'DeepSeek Pro',
    provider: 'deepseek' as const,
    model: 'deepseek-v4-pro',
    baseUrl: 'https://api.deepseek.com/v1',
  },
  {
    id: 'dashscope',
    label: '通义千问 Qwen',
    provider: 'dashscope' as const,
    model: 'qwen-max',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    provider: 'custom' as const,
    model: 'llama3.1:70b',
    baseUrl: 'http://127.0.0.1:11434/v1',
  },
  {
    id: 'llama-server',
    label: 'llama-server',
    provider: 'custom' as const,
    model: 'llama3.1:8b',
    baseUrl: 'http://127.0.0.1:8080/v1',
  },
]

const DEFAULT_STREAM_STALE_TIMEOUT_SECONDS = 90
const DEFAULT_STREAM_READ_TIMEOUT_SECONDS = 60
const MODEL_PROVIDER_VALUES = new Set<ModelProviderOption>(
  MODEL_PROVIDER_OPTIONS.map((option) => option.value as ModelProviderOption),
)

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readModelEnvSnapshot(config: HermesConfig | undefined): Record<string, string> {
  const env = readRecord(config?.__env)
  if (!env) return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim()
    }
  }
  return result
}

function parseModelProvider(value: unknown): ModelProviderOption {
  return typeof value === 'string' &&
    MODEL_PROVIDER_VALUES.has(value as ModelProviderOption)
    ? (value as ModelProviderOption)
    : 'custom'
}

function readPrimaryModelConfig(
  config: HermesConfig | undefined,
): ModelConfigDraft {
  const modelBlock = readRecord(config?.model)
  const flatModel = typeof config?.model === 'string' ? config.model : ''
  const provider = parseModelProvider(modelBlock?.provider ?? config?.provider)
  const envKey = providerApiKeyEnvName(provider)
  const env = readModelEnvSnapshot(config)

  return {
    provider,
    model: coerceString(modelBlock?.default ?? flatModel),
    baseUrl: coerceString(modelBlock?.base_url ?? config?.base_url),
    apiKey:
      coerceString(modelBlock?.api_key ?? config?.api_key) ||
      (envKey ? env[envKey] || '' : ''),
  }
}

function readFallbackModelConfig(
  config: HermesConfig | undefined,
): ModelConfigDraft {
  const fallbackBlock = readRecord(config?.fallback_model)
  const provider = parseModelProvider(fallbackBlock?.provider)
  const envKey = providerApiKeyEnvName(provider)
  const env = readModelEnvSnapshot(config)

  return {
    provider,
    model: coerceString(fallbackBlock?.model),
    baseUrl: coerceString(fallbackBlock?.base_url),
    apiKey:
      coerceString(fallbackBlock?.api_key) ||
      (envKey ? env[envKey] || '' : ''),
  }
}

function readPerformanceConfig(
  config: HermesConfig | undefined,
): PerformanceDraft {
  const performanceBlock = readRecord(config?.performance)
  const staleTimeout =
    performanceBlock?.stream_stale_timeout ?? config?.stream_stale_timeout
  const readTimeout =
    performanceBlock?.stream_read_timeout ?? config?.stream_read_timeout

  return {
    streamStaleTimeout:
      typeof staleTimeout === 'number' && Number.isFinite(staleTimeout)
        ? String(staleTimeout)
        : String(DEFAULT_STREAM_STALE_TIMEOUT_SECONDS),
    streamReadTimeout:
      typeof readTimeout === 'number' && Number.isFinite(readTimeout)
        ? String(readTimeout)
        : String(DEFAULT_STREAM_READ_TIMEOUT_SECONDS),
  }
}

function hasModelConfigValue(value: ModelConfigDraft): boolean {
  return Boolean(value.model.trim() || value.baseUrl.trim() || value.apiKey.trim())
}

function providerApiKeyEnvName(provider: ModelProviderOption): string | null {
  switch (provider) {
    case 'deepseek':
      return 'DEEPSEEK_API_KEY'
    case 'dashscope':
      return 'DASHSCOPE_API_KEY'
    case 'openrouter':
      return 'OPENROUTER_API_KEY'
    case 'anthropic':
      return 'ANTHROPIC_API_KEY'
    case 'openai':
      return 'OPENAI_API_KEY'
    default:
      return null
  }
}

function parseTimeoutInput(value: string, fallback: number): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function ModelConfigSection(props: {
  title: string
  description: string
  value: ModelConfigDraft
  onChange: (nextValue: ModelConfigDraft) => void
  modelOptions: Array<SelectOption>
  showPresets?: boolean
  datalistId: string
}) {
  const {
    title,
    description,
    value,
    onChange,
    modelOptions,
    showPresets = false,
    datalistId,
  } = props

  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--theme-text)]">{title}</h3>
        <p className="text-sm text-[var(--theme-muted)]">{description}</p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            服务提供方
          </span>
          <select
            className="h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 text-sm text-[var(--theme-text)] outline-none"
            value={value.provider}
            onChange={(event) => {
              onChange({
                ...value,
                provider: parseModelProvider(event.target.value),
              })
            }}
          >
            {MODEL_PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            模型名称
          </span>
          <Input
            value={value.model}
            list={datalistId}
            placeholder="gpt-4.1, claude-sonnet-4-5, qwen2.5:32b"
            className="border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-sm"
            onChange={(event) => {
              onChange({
                ...value,
                model: event.target.value,
              })
            }}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            接口地址
          </span>
          <Input
            value={value.baseUrl}
            placeholder="https://api.deepseek.com/v1"
            className="border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-sm"
            onChange={(event) => {
              onChange({
                ...value,
                baseUrl: event.target.value,
              })
            }}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
            API Key
          </span>
          <Input
            type="password"
            value={value.apiKey}
            placeholder="sk-..."
            className="border-[var(--theme-border)] bg-[var(--theme-card)] font-mono text-sm"
            onChange={(event) => {
              onChange({
                ...value,
                apiKey: event.target.value,
              })
            }}
          />
        </label>
      </div>

      {showPresets ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {MODEL_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant="outline"
              className="border-[var(--theme-border)] bg-[var(--theme-card)]"
              onClick={() => {
                onChange({
                  ...value,
                  provider: preset.provider,
                  baseUrl: preset.baseUrl,
                  model: preset.model ?? value.model,
                })
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}

      <datalist id={datalistId}>
        {modelOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </datalist>
    </section>
  )
}

function ActiveModelCard({
  modelOptions,
}: {
  modelOptions: Array<SelectOption>
}) {
  const queryClient = useQueryClient()
  const [primaryConfig, setPrimaryConfig] = useState<ModelConfigDraft>({
    provider: 'custom',
    model: '',
    baseUrl: '',
    apiKey: '',
  })
  const [fallbackConfig, setFallbackConfig] = useState<ModelConfigDraft>({
    provider: 'custom',
    model: '',
    baseUrl: '',
    apiKey: '',
  })
  const [performanceConfig, setPerformanceConfig] = useState<PerformanceDraft>({
    streamStaleTimeout: String(DEFAULT_STREAM_STALE_TIMEOUT_SECONDS),
    streamReadTimeout: String(DEFAULT_STREAM_READ_TIMEOUT_SECONDS),
  })
  const [showFallback, setShowFallback] = useState(false)

  const configQuery = useQuery({
    queryKey: ['hermes', 'active-config'],
    queryFn: async () => {
      const response = await fetch('/api/config-get')
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; payload?: HermesConfig; error?: string }
        | null
      if (!response.ok || payload?.ok === false || !payload?.payload) {
        throw new Error(payload?.error || '读取模型配置失败')
      }
      return payload.payload
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedPrimaryModel = stripProviderPrefix(
        primaryConfig.model.trim(),
      )
      const normalizedFallbackModel = stripProviderPrefix(
        fallbackConfig.model.trim(),
      )
      const streamStaleTimeout = parseTimeoutInput(
        performanceConfig.streamStaleTimeout,
        DEFAULT_STREAM_STALE_TIMEOUT_SECONDS,
      )
      const streamReadTimeout = parseTimeoutInput(
        performanceConfig.streamReadTimeout,
        DEFAULT_STREAM_READ_TIMEOUT_SECONDS,
      )

      const patch: Record<string, unknown> = {
        model: normalizedPrimaryModel,
        provider: primaryConfig.provider,
        base_url: primaryConfig.baseUrl.trim(),
        api_key: primaryConfig.apiKey.trim(),
        stream_stale_timeout: streamStaleTimeout,
        stream_read_timeout: streamReadTimeout,
        performance: {
          stream_stale_timeout: streamStaleTimeout,
          stream_read_timeout: streamReadTimeout,
        },
      }

      patch.fallback_model = hasModelConfigValue(fallbackConfig)
        ? {
            provider: fallbackConfig.provider,
            model: normalizedFallbackModel,
            base_url: fallbackConfig.baseUrl.trim(),
            api_key: fallbackConfig.apiKey.trim(),
          }
        : null

      const env: Record<string, string> = {}
      const primaryEnvName = providerApiKeyEnvName(primaryConfig.provider)
      if (primaryEnvName && primaryConfig.apiKey.trim()) {
        env[primaryEnvName] = primaryConfig.apiKey.trim()
      }
      const fallbackEnvName = providerApiKeyEnvName(fallbackConfig.provider)
      if (fallbackEnvName && fallbackConfig.apiKey.trim()) {
        env[fallbackEnvName] = fallbackConfig.apiKey.trim()
      }

      const response = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw: JSON.stringify(patch),
          ...(Object.keys(env).length > 0 ? { env } : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || '保存模型配置失败')
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['hermes', 'active-config'],
        }),
        queryClient.invalidateQueries({ queryKey: ['hermes', 'config'] }),
        queryClient.invalidateQueries({ queryKey: ['hermes-config'] }),
      ])
      toast('模型配置已保存，将在下一条消息时生效。', {
        type: 'success',
      })
    },
    onError: (error) => {
      toast(
        error instanceof Error ? error.message : '保存模型配置失败',
        { type: 'error' },
      )
    },
  })

  useEffect(() => {
    if (!configQuery.data) return
    setPrimaryConfig(readPrimaryModelConfig(configQuery.data))
    setFallbackConfig(readFallbackModelConfig(configQuery.data))
    setPerformanceConfig(readPerformanceConfig(configQuery.data))
  }, [configQuery.data])

  return (
    <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-[var(--theme-text)]">
            模型配置
          </h3>
          <p className="text-sm text-[var(--theme-muted)]">
            更新主模型、可选回退模型、接口地址、API Key 和流式超时。
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void saveMutation.mutateAsync()}
          disabled={configQuery.isPending || saveMutation.isPending}
        >
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </div>

      {configQuery.isPending ? (
        <p className="mt-4 text-sm text-[var(--theme-muted)]">
          加载配置中…
        </p>
      ) : configQuery.error ? (
        <p className="mt-4 text-sm text-red-500">
          加载配置失败 — 请确保 Hermes Agent 正在运行。
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <ModelConfigSection
            title="主模型"
            description="新 Hermes 请求默认使用的服务提供方、模型和接口地址。"
            value={primaryConfig}
            onChange={setPrimaryConfig}
            modelOptions={modelOptions}
            showPresets
            datalistId="settings-primary-model-options"
          />

          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                  回退模型
                </h3>
                <p className="text-sm text-[var(--theme-muted)]">
                  当主链路失败时使用的可选备用模型。
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[var(--theme-border)] bg-[var(--theme-card)]"
                onClick={() => {
                  setShowFallback((current) => !current)
                }}
              >
                {showFallback ? '隐藏回退配置' : '显示回退配置'}
              </Button>
            </div>

            {showFallback ? (
              <div className="mt-4">
                <ModelConfigSection
                  title="回退设置"
                  description="如果不需要回退模型，请留空这些字段。"
                  value={fallbackConfig}
                  onChange={setFallbackConfig}
                  modelOptions={modelOptions}
                  datalistId="settings-fallback-model-options"
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[var(--theme-text)]">
                性能
              </h3>
              <p className="text-sm text-[var(--theme-muted)]">
                如果本地模型较慢，或长提示词导致输出变慢，请考虑调高这些超时时间。
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                  流式停滞超时
                </span>
                <Input
                  type="number"
                  min={1}
                  value={performanceConfig.streamStaleTimeout}
                  className="border-[var(--theme-border)] bg-[var(--theme-card)] text-sm"
                  onChange={(event) => {
                    setPerformanceConfig((current) => ({
                      ...current,
                      streamStaleTimeout: event.target.value,
                    }))
                  }}
                />
                <p className="text-xs text-[var(--theme-muted)]">默认：90 秒</p>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--theme-muted)]">
                  流式读取超时
                </span>
                <Input
                  type="number"
                  min={1}
                  value={performanceConfig.streamReadTimeout}
                  className="border-[var(--theme-border)] bg-[var(--theme-card)] text-sm"
                  onChange={(event) => {
                    setPerformanceConfig((current) => ({
                      ...current,
                      streamReadTimeout: event.target.value,
                    }))
                  }}
                />
                <p className="text-xs text-[var(--theme-muted)]">默认：60 秒</p>
              </label>
            </div>

            <p className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card2)] px-3 py-2 text-sm text-[var(--theme-muted)]">
              像 Ollama 和 `llama-server` 这样较慢的本地运行时通常需要额外的缓冲时间，以免 Hermes 过早认为流已中断。
            </p>
          </section>
        </div>
      )}
    </section>
  )
}

function ProviderManagementSection(props: {
  embedded: boolean
  providerSummaries: Array<ProviderSummary>
  modelsQuery: ReturnType<
    typeof useQuery<{
      ok?: boolean
      models?: Array<ModelCatalogEntry>
      configuredProviders?: Array<string>
    }>
  >
  deletingId: string | null
  onAddProvider: () => void
  onEdit: (provider: ProviderSummary) => void
  onDelete: (provider: ProviderSummary) => void
}) {
  const {
    embedded,
    providerSummaries,
    modelsQuery,
    deletingId,
    onAddProvider,
    onEdit,
    onDelete,
  } = props

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-base font-semibold text-[var(--theme-text)]">
            服务提供方配置
          </h2>
          <p className="text-sm text-[var(--theme-muted)]">
            查看已配置的服务提供方，并使用向导安全地接入新的服务提供方。
          </p>
        </div>
        <Button size="sm" onClick={onAddProvider}>
          <HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.5} />
          添加服务提供方
        </Button>
      </header>

      <section className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-medium text-[var(--theme-text)]">
              已配置的服务提供方
            </h3>
            <p className="mt-1 text-xs text-[var(--theme-muted)]">
              API 密钥仅存储在本地 Hermes 配置中，绝不会发送到 Studio。
            </p>
          </div>
          <p className="text-xs text-[var(--theme-muted)] tabular-nums">
            共 {providerSummaries.length} 个服务提供方
          </p>
        </div>

        {modelsQuery.isPending ? (
          <p className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-muted)]">
            正在从 Hermes 加载服务提供方…
          </p>
        ) : null}

        {modelsQuery.error ? (
          <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
            <p className="mb-2 text-sm text-[var(--theme-text)]">
              当前无法加载服务提供方 — 请检查 Hermes 连接状态。
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => modelsQuery.refetch()}
            >
              重试
            </Button>
          </div>
        ) : null}

        {!modelsQuery.isPending &&
        !modelsQuery.error &&
        providerSummaries.length === 0 ? (
          <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-4">
            <p className="text-sm text-[var(--theme-text)]">
              尚未配置服务提供方。点击“添加服务提供方”开始。
            </p>
          </div>
        ) : null}

        {providerSummaries.length > 0 ? (
          <div className={cn('grid gap-3', embedded ? '' : 'md:grid-cols-2')}>
            {providerSummaries.map(function mapProvider(provider) {
              const isDeleting = deletingId === provider.id

              return (
                <article
                  key={provider.id}
                  className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70">
                        <ProviderIcon providerId={provider.id} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-medium text-[var(--theme-text)]">
                          {provider.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--theme-muted)] line-clamp-2">
                          {provider.description}
                        </p>
                      </div>
                    </div>
                    <ProviderStatusBadge status={provider.status} />
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-2.5 py-2">
                    <span className="text-xs text-[var(--theme-muted)]">
                      可用模型
                    </span>
                    <span className="text-sm font-medium text-[var(--theme-text)] tabular-nums">
                      {provider.modelCount}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={function onProviderEdit() {
                        onEdit(provider)
                      }}
                      disabled={isDeleting}
                      aria-label={`编辑 ${provider.name}`}
                    >
                      <HugeiconsIcon
                        icon={Edit01Icon}
                        size={14}
                        strokeWidth={1.5}
                      />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={function onProviderDelete() {
                        onDelete(provider)
                      }}
                      disabled={isDeleting}
                      aria-label={`删除 ${provider.name}`}
                    >
                      <HugeiconsIcon
                        icon={Delete02Icon}
                        size={14}
                        strokeWidth={1.5}
                      />
                      {isDeleting ? '删除中…' : '删除'}
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </section>
    </div>
  )
}

export function ProvidersScreen({ embedded = false }: ProvidersScreenProps) {
  const queryClient = useQueryClient()
  const configAvailable = useFeatureAvailable('config')
  const [activeTab, setActiveTab] = useState<SettingsTabId>('providers')
  const [search, setSearch] = useState('')
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingProvider, setEditingProvider] =
    useState<ProviderSummaryForEdit | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const modelsQuery = useQuery({
    queryKey: ['hermes', 'providers', 'models'],
    queryFn: fetchModels,
    refetchInterval: 60_000,
    retry: false,
    enabled: configAvailable,
  })

  const configQuery = useQuery({
    queryKey: ['hermes', 'config'],
    queryFn: async () => {
      const response = await fetch('/api/config-get')
      const payload = (await response
        .json()
        .catch(() => ({}))) as ConfigQueryResponse
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
      return payload.payload ?? {}
    },
    retry: 1,
    enabled: configAvailable,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ path, value }: SaveSettingPayload) => {
      const response = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, value }),
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as ConfigPatchResponse
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`)
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['hermes', 'config'] })
      toast(`${variables.label} 已保存`, { type: 'success' })
    },
    onError: (error) => {
      toast(error instanceof Error ? error.message : '保存设置失败', {
        type: 'error',
      })
    },
  })

  const providerSummaries = useMemo(
    function resolveProviderSummaries() {
      return buildProviderSummaries({
        models: Array.isArray(modelsQuery.data?.models)
          ? modelsQuery.data.models
          : [],
        configuredProviders: Array.isArray(
          modelsQuery.data?.configuredProviders,
        )
          ? modelsQuery.data.configuredProviders
          : [],
      })
    },
    [modelsQuery.data?.configuredProviders, modelsQuery.data?.models],
  )

  const modelOptions = useMemo(
    function resolveModelOptions() {
      return buildModelOptions(
        Array.isArray(modelsQuery.data?.models) ? modelsQuery.data.models : [],
      )
    },
    [modelsQuery.data?.models],
  )

  const searchQuery = search.trim().toLowerCase()

  const filteredSettings = useMemo(
    function filterSettings() {
      if (!searchQuery) return SETTINGS
      return SETTINGS.filter((setting) =>
        searchMatchesSetting(setting, searchQuery),
      )
    },
    [searchQuery],
  )

  const settingsByTab = useMemo(
    function groupSettingsByTab() {
      return TAB_ORDER.reduce<Record<SettingsTabId, Array<SettingDefinition>>>(
        (accumulator, tab) => {
          accumulator[tab.id] = filteredSettings.filter(
            (setting) => setting.tab === tab.id,
          )
          return accumulator
        },
        {
          providers: [],
          models: [],
          agents: [],
          session: [],
          memory: [],
        },
      )
    },
    [filteredSettings],
  )

  function handleEdit(provider: ProviderSummary) {
    setEditingProvider({ id: provider.id, name: provider.name })
    setWizardOpen(true)
  }

  async function handleDelete(provider: ProviderSummary) {
    const confirmed = window.confirm(
      `确定移除服务提供方 "${provider.name}"？这将从本地配置中删除对应的 API 密钥。`,
    )
    if (!confirmed) return

    setDeletingId(provider.id)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-provider',
          provider: provider.id,
        }),
      })
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) {
        toast(`移除服务提供方失败：${data.error ?? '未知错误'}`, {
          type: 'error',
        })
      } else {
        await queryClient.invalidateQueries({
          queryKey: ['hermes', 'providers', 'models'],
        })
        toast(`服务提供方 "${provider.name}" 已移除`, { type: 'success' })
      }
    } catch {
      toast('网络错误，移除服务提供方失败。', { type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  async function saveSetting(payload: SaveSettingPayload) {
    await saveMutation.mutateAsync(payload)
  }

  function handleWizardOpenChange(open: boolean) {
    setWizardOpen(open)
    if (!open) {
      setEditingProvider(null)
    }
  }

  const totalSearchMatches = filteredSettings.length

  if (!configAvailable) {
    return (
      <div
        className={cn(
          embedded ? 'h-full bg-[var(--theme-bg)]' : 'min-h-full bg-[var(--theme-bg)]',
        )}
      >
        <BackendUnavailableState
          feature="服务提供方配置"
          description={getUnavailableReason('config')}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        embedded ? 'h-full bg-[var(--theme-bg)]' : 'min-h-full bg-[var(--theme-bg)]',
      )}
    >
      <main
        className={cn(
          'min-h-full px-4 pb-24 pt-5 text-[var(--theme-text)] md:px-6 md:pt-8',
          embedded && 'px-4 pb-6 pt-4 md:px-6 md:pb-6 md:pt-4',
        )}
      >
        <section className="mx-auto w-full max-w-[1480px] space-y-5">
          <header className="flex flex-col gap-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] px-5 py-4 shadow-sm">
            <div className="space-y-1">
              <h1 className="hidden md:block text-lg font-semibold text-[var(--theme-text)]">
                设置
              </h1>
              <p className="text-sm text-[var(--theme-muted)]">
                在一个地方配置服务提供方和 Hermes 智能体默认设置。
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="relative w-full md:max-w-md">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--theme-muted)]">
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={18}
                    strokeWidth={1.8}
                  />
                </span>
                <Input
                  value={search}
                  type="search"
                  placeholder="搜索设置、路径或描述"
                  className="pl-10"
                  onChange={(event) => {
                    setSearch(event.target.value)
                  }}
                />
              </label>

              <div className="text-sm text-[var(--theme-muted)]">
                {searchQuery
                  ? `匹配到 ${totalSearchMatches} 项设置`
                  : `${SETTINGS.length} 项可配置默认值`}
              </div>
            </div>
          </header>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as SettingsTabId)}
          >
            <TabsList
              variant="underline"
              className="w-full flex-nowrap overflow-x-auto justify-start gap-2 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2"
            >
              {TAB_ORDER.map((tab) => {
                const count =
                  tab.id === 'providers'
                    ? providerSummaries.length
                    : settingsByTab[tab.id].length
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="rounded-lg px-3 py-2 text-sm"
                  >
                    {tab.label}
                    <span className="ml-1 rounded-full bg-[var(--theme-panel)] px-1.5 py-0.5 text-[11px] text-[var(--theme-text)]">
                      {count}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value="providers" className="space-y-5">
              <ActiveModelCard modelOptions={modelOptions} />
              <ProviderManagementSection
                embedded={embedded}
                providerSummaries={providerSummaries}
                modelsQuery={modelsQuery}
                deletingId={deletingId}
                onAddProvider={() => {
                  setEditingProvider(null)
                  setWizardOpen(true)
                }}
                onEdit={handleEdit}
                onDelete={(provider) => {
                  void handleDelete(provider)
                }}
              />
            </TabsContent>

            {TAB_ORDER.filter((tab) => tab.id !== 'providers').map((tab) => {
              const items = settingsByTab[tab.id]
              return (
                <TabsContent key={tab.id} value={tab.id} className="space-y-4">
                  {configQuery.isPending ? (
                    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-3 text-sm text-[var(--theme-muted)]">
                      正在加载当前配置…
                    </div>
                  ) : null}

                  {configQuery.error ? (
                    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3">
                      <p className="text-sm text-[var(--theme-text)]">
                        无法加载当前配置。
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => configQuery.refetch()}
                      >
                        重试
                      </Button>
                    </div>
                  ) : null}

                  {!configQuery.isPending &&
                  !configQuery.error &&
                  items.length === 0 ? (
                    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg)] px-4 py-4 text-sm text-[var(--theme-muted)]">
                      此标签页中没有匹配搜索的设置。
                    </div>
                  ) : null}

                  {!configQuery.isPending && !configQuery.error
                    ? items.map((setting) => (
                        <SettingCard
                          key={setting.id}
                          setting={setting}
                          config={configQuery.data}
                          draftValues={draftValues}
                          setDraftValues={setDraftValues}
                          saveSetting={saveSetting}
                          isSaving={saveMutation.isPending}
                          savePath={saveMutation.variables?.path ?? null}
                          modelOptions={modelOptions}
                        />
                      ))
                    : null}
                </TabsContent>
              )
            })}
          </Tabs>
        </section>
      </main>

      <ProviderWizard
        open={wizardOpen}
        onOpenChange={handleWizardOpenChange}
        editProvider={editingProvider}
      />
    </div>
  )
}
