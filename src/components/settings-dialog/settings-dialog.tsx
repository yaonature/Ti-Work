'use client'

import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowLeft01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CloudIcon,
  MessageMultiple01Icon,
  Mic01Icon,
  Moon01Icon,
  Notification03Icon,
  PaintBoardIcon,
  Settings02Icon,
  SparklesIcon,
  VolumeHighIcon,
} from '@hugeicons/core-free-icons'
import { Component, useCallback, useEffect, useRef, useState } from 'react'
import type * as React from 'react'
import type { AccentColor, SettingsThemeMode } from '@/hooks/use-settings'
import type { LoaderStyle } from '@/hooks/use-chat-settings'
import type { BrailleSpinnerPreset } from '@/components/ui/braille-spinner'
import type { ThemeId } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { EmojiIcon, LobsterIcon } from '@/components/emoji-icon'
import { Switch } from '@/components/ui/switch'
import { applyTheme, getStoredThemeMode, useSettings } from '@/hooks/use-settings'
import { ThemeToggle } from '@/components/theme-toggle'
import { THEMES, getTheme, setTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import {
  getChatProfileDisplayName,
  useChatSettingsStore,
} from '@/hooks/use-chat-settings'
import { UserAvatar } from '@/components/avatars'
import { Input } from '@/components/ui/input'
import { LogoLoader } from '@/components/logo-loader'
import { BrailleSpinner } from '@/components/ui/braille-spinner'
import { ThreeDotsSpinner } from '@/components/ui/three-dots-spinner'
import { applyAccentColor } from '@/lib/accent-colors'
import { useFeatureAvailable } from '@/hooks/use-feature-available'
import { ProviderLogo } from '@/components/provider-logo'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'

// ── Types ───────────────────────────────────────────────────────────────

type SectionId =
  | 'hermes'
  | 'agent'
  | 'routing'
  | 'voice'
  | 'display'
  | 'appearance'
  | 'chat'
  | 'notifications'

const SECTIONS: Array<{ id: SectionId; label: string; icon: any }> = [
  { id: 'hermes', label: '模型与服务商', icon: CloudIcon },
  { id: 'agent', label: '智能体', icon: Settings02Icon },
  { id: 'routing', label: '智能路由', icon: SparklesIcon },
  { id: 'voice', label: '语音', icon: VolumeHighIcon },
  { id: 'display', label: '显示', icon: PaintBoardIcon },
  { id: 'appearance', label: '主题', icon: PaintBoardIcon },
  { id: 'chat', label: '会话', icon: MessageMultiple01Icon },
  { id: 'notifications', label: '通知', icon: Notification03Icon },
]

const DARK_ENTERPRISE_THEMES = new Set<ThemeId>([
  'hermes-official',
  'hermes-classic',
  'hermes-slate',
  'hermes-mono',
])

function _isDarkEnterpriseTheme(theme: string | null): theme is ThemeId {
  if (!theme) return false
  return DARK_ENTERPRISE_THEMES.has(theme as ThemeId)
}
void _isDarkEnterpriseTheme

// ── Shared building blocks ──────────────────────────────────────────────

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
        Settings
      </p>
      <h3 className="text-base font-semibold text-primary-900 dark:text-neutral-100">
        {title}
      </h3>
      <p className="text-xs text-primary-500 dark:text-neutral-400">
        {description}
      </p>
    </div>
  )
}

function Row({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary-900 dark:text-neutral-100">
          {label}
        </p>
        {description && (
          <p className="text-xs text-primary-500 dark:text-neutral-400">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

const SETTINGS_CARD_CLASS =
  'rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 shadow-sm'

// ── Section components ──────────────────────────────────────────────────

const PROVIDER_CARDS: Array<{
  id: string
  name: string
  logo: string
  models: Array<string>
  authType: 'oauth' | 'api_key' | 'none'
  envKey?: string
}> = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '/providers/deepseek.png',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    authType: 'api_key',
    envKey: 'DEEPSEEK_API_KEY',
  },
  {
    id: 'dashscope',
    name: '通义千问 Qwen',
    logo: '/providers/qwen.png',
    models: ['qwen-max', 'qwen-plus', 'qwen3'],
    authType: 'api_key',
    envKey: 'DASHSCOPE_API_KEY',
  },
  {
    id: 'nous',
    name: 'Nous Portal',
    logo: '/providers/nous.png',
    models: ['hermes-3-llama-3.1-405b', 'hermes-3-llama-3.1-70b'],
    authType: 'oauth',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    logo: '/providers/openai.png',
    models: ['gpt-5.4', 'gpt-5.3-codex', 'gpt-4o'],
    authType: 'oauth',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '/providers/anthropic.png',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-3-5'],
    authType: 'api_key',
    envKey: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '/providers/openrouter.png',
    models: ['auto', 'deepseek/deepseek-r1', 'google/gemini-2.5-pro'],
    authType: 'api_key',
    envKey: 'OPENROUTER_API_KEY',
  },
  {
    id: 'zai',
    name: 'Z.AI / GLM',
    logo: '/providers/zhipu.png',
    models: ['glm-4-plus', 'glm-4-air'],
    authType: 'api_key',
    envKey: 'GLM_API_KEY',
  },
  {
    id: 'kimi-coding',
    name: 'Kimi',
    logo: '/providers/kimi.png',
    models: ['kimi-latest', 'moonshot-v1-128k'],
    authType: 'api_key',
    envKey: 'KIMI_API_KEY',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    logo: '/providers/minimax.png',
    models: ['MiniMax-M2.5', 'MiniMax-M2.5-Lightning'],
    authType: 'api_key',
    envKey: 'MINIMAX_API_KEY',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    logo: '/providers/ollama.png',
    models: ['llama3.1:70b', 'qwen3:32b', 'deepseek-r1:32b'],
    authType: 'none',
  },
  { id: 'custom', name: '自定义', logo: '', models: [], authType: 'api_key' },
]

function HermesContent() {
  const configAvailable = useFeatureAvailable('config')
  const [activeProvider, setActiveProvider] = useState('')
  const [activeModel, setActiveModel] = useState('')
  const [availableModels, setAvailableModels] = useState<Array<string>>([])
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [_saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, string>>(
    {},
  )
  const [memEnabled, setMemEnabled] = useState(true)
  const [userProfileEnabled, setUserProfileEnabled] = useState(true)

  const fetchModelsForProvider = useCallback((providerId: string) => {
    fetch(
      `/api/hermes-proxy/api/available-models?provider=${encodeURIComponent(providerId)}`,
    )
      .then((r) => r.json())
      .then((d: { models?: Array<{ id: string }> }) => {
        setAvailableModels((d.models || []).map((m) => m.id))
      })
      .catch(() => {
        // Fall back to hardcoded
        const card = PROVIDER_CARDS.find((p) => p.id === providerId)
        setAvailableModels(card?.models || [])
      })
  }, [])

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: any) => {
        setActiveProvider(d.activeProvider || '')
        setActiveModel(d.activeModel || '')
        if (d.activeProvider) fetchModelsForProvider(d.activeProvider)
        const mem = (d.config?.memory as Record<string, unknown>) || {}
        setMemEnabled(mem.memory_enabled !== false)
        setUserProfileEnabled(mem.user_profile_enabled !== false)
        // Build configured keys map
        const keys: Record<string, string> = {}
        for (const p of d.providers || []) {
          if (p.configured && p.envKeys?.[0])
            keys[p.envKeys[0]] = p.maskedKeys?.[p.envKeys[0]] || '••••'
        }
        setConfiguredKeys(keys)
      })
      .catch(() => {})
  }, [])

  const save = async (updates: {
    config?: Record<string, unknown>
    env?: Record<string, string>
  }) => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const r = (await res.json()) as { message?: string }
      setMsg(r.message || '已保存')
      const ref = await fetch('/api/hermes-config')
      const d = await ref.json()
      setActiveProvider(d.activeProvider || '')
      setActiveModel(d.activeModel || '')
      const keys: Record<string, string> = {}
      for (const p of d.providers || []) {
        if (p.configured && p.envKeys?.[0])
          keys[p.envKeys[0]] = p.maskedKeys?.[p.envKeys[0]] || '••••'
      }
      setConfiguredKeys(keys)
      setTimeout(() => setMsg(null), 3000)
    } catch {
      setMsg('保存失败')
    }
    setSaving(false)
  }

  const selectProvider = (providerId: string, model?: string) => {
    setActiveProvider(providerId)
    if (model) {
      setActiveModel(model)
      save({ config: { model, provider: providerId } })
    } else {
      // Switching provider without a model — fetch models and pick the first one
      fetchModelsForProvider(providerId)
      save({ config: { provider: providerId } })
    }
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-text)',
  }
  const mutedStyle: React.CSSProperties = { color: 'var(--theme-muted)' }

  return (
    <div className="space-y-5">
      {!configAvailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <HugeiconsIcon
              icon={Alert02Icon}
              size={16}
              strokeWidth={1.7}
              className="mt-0.5 shrink-0 text-amber-500"
            />
            <div className="text-xs leading-5">
              <p className="font-semibold text-amber-500">
                网关未连接或版本过旧
              </p>
              <p className="mt-0.5 text-amber-500/80">
                模型列表已降级为内置默认值，本地 Provider / API Key 配置不受影响。连接支持增强 API
                的 Hermes 网关后，可在线拉取可用模型并解锁完整能力。
              </p>
            </div>
          </div>
        </div>
      )}
      {msg && (
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium',
            msg.includes('失败')
              ? 'bg-red-500/15 text-red-400'
              : 'bg-green-500/15 text-green-400',
          )}
        >
          {msg}
        </div>
      )}

      {/* Provider Selection */}
      <div>
        <p
          className="mb-1 text-xs font-semibold uppercase tracking-wider"
          style={mutedStyle}
        >
          Provider
        </p>
        <p className="mb-3 text-[11px]" style={mutedStyle}>
          选择你的 AI 服务提供方。OAuth 服务提供方通过浏览器完成认证。
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROVIDER_CARDS.map((p) => {
            const isActive = activeProvider === p.id
            const hasKey =
              p.authType === 'none' ||
              p.authType === 'oauth' ||
              (p.envKey ? !!configuredKeys[p.envKey] : false)
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  if (hasKey) selectProvider(p.id)
                }}
                className={cn(
                  'flex flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition-all',
                  isActive
                    ? 'ring-2 ring-accent-500 shadow-md'
                    : 'hover:brightness-110',
                  !hasKey && p.authType === 'api_key' && 'opacity-60',
                )}
                style={cardStyle}
              >
                <div className="flex w-full items-center justify-between">
                  <ProviderLogo provider={p.id} size={32} />
                  {isActive && (
                    <span className="size-2 rounded-full bg-green-500" />
                  )}
                  {!isActive && hasKey && (
                    <span className="size-2 rounded-full bg-green-500/40" />
                  )}
                  {!hasKey && p.authType === 'api_key' && (
                    <span className="size-2 rounded-full bg-red-500/60" />
                  )}
                </div>
                <span className="text-xs font-semibold mt-1">{p.name}</span>
                <span className="text-[9px]" style={mutedStyle}>
                  {p.authType === 'oauth'
                    ? 'OAuth'
                    : p.authType === 'none'
                      ? 'Local'
                      : hasKey
                        ? '密钥已设置'
                        : '需要密钥'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Model Selection for active provider */}
      {activeProvider && (
        <div>
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-wider"
            style={mutedStyle}
          >
            模型
          </p>
          <div className="flex flex-wrap gap-2">
            {(availableModels.length > 0
              ? availableModels
              : PROVIDER_CARDS.find((p) => p.id === activeProvider)?.models ||
                []
            ).map((model) => (
              <button
                key={model}
                type="button"
                onClick={() => selectProvider(activeProvider, model)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  activeModel === model
                    ? 'ring-2 ring-accent-500'
                    : 'hover:brightness-110',
                )}
                style={cardStyle}
              >
                {model}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* API Keys */}
      <div>
        <p
          className="mb-1 text-xs font-semibold uppercase tracking-wider"
          style={mutedStyle}
        >
          API Keys
        </p>
        <div className="space-y-1.5">
          {PROVIDER_CARDS.filter((p) => p.envKey).map((p) => {
            const key = p.envKey!
            const hasKey = !!configuredKeys[key]
            const isEditing = editingKey === key
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={cardStyle}
              >
                <ProviderLogo
                  provider={p.id}
                  size={28}
                  className="rounded-md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[11px] font-mono" style={mutedStyle}>
                    {isEditing ? (
                      <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder={`Paste ${key}`}
                        className="w-full rounded border-0 bg-transparent py-0.5 text-[11px] outline-none"
                        style={{ color: 'var(--theme-text)' }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && keyInput) {
                            save({
                              env: { [key]: keyInput },
                              config: {
                                provider: p.id,
                                ...(p.models?.[0]
                                  ? { model: p.models[0] }
                                  : {}),
                              },
                            })
                            setEditingKey(null)
                            setKeyInput('')
                          }
                          if (e.key === 'Escape') {
                            setEditingKey(null)
                            setKeyInput('')
                          }
                        }}
                      />
                    ) : hasKey ? (
                      configuredKeys[key]
                    ) : (
                      '未配置'
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      hasKey ? 'bg-green-500' : 'bg-neutral-500',
                    )}
                  />
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (keyInput) {
                            save({
                              env: { [key]: keyInput },
                              config: {
                                provider: p.id,
                                ...(p.models?.[0]
                                  ? { model: p.models[0] }
                                  : {}),
                              },
                            })
                          }
                          setEditingKey(null)
                          setKeyInput('')
                        }}
                        className="rounded-lg px-2 py-1 text-[11px] font-medium bg-accent-500 text-white"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingKey(null)
                          setKeyInput('')
                        }}
                        className="rounded-lg px-2 py-1 text-[11px] font-medium"
                        style={{ color: 'var(--theme-muted)' }}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(key)
                        setKeyInput('')
                      }}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-accent-500/10"
                      style={{
                        color: 'var(--theme-accent, var(--theme-text))',
                      }}
                    >
                      {hasKey ? '更新' : '添加'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Memory */}
      <div>
        <p
          className="mb-1 text-xs font-semibold uppercase tracking-wider"
          style={mutedStyle}
        >
          记忆
        </p>
        <div className="space-y-1.5">
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={cardStyle}
          >
            <div>
              <div className="text-sm font-medium">记忆</div>
              <div className="text-[11px]" style={mutedStyle}>
                跨会话存储与回忆记忆
              </div>
            </div>
            <Switch
              checked={memEnabled}
              onCheckedChange={(c) => {
                setMemEnabled(c)
                save({ config: { memory: { memory_enabled: c } } })
              }}
            />
          </div>
          <div
            className="flex items-center justify-between rounded-xl px-3 py-2.5"
            style={cardStyle}
          >
            <div>
              <div className="text-sm font-medium">用户资料</div>
              <div className="text-[11px]" style={mutedStyle}>
                记住偏好与上下文
              </div>
            </div>
            <Switch
              checked={userProfileEnabled}
              onCheckedChange={(c) => {
                setUserProfileEnabled(c)
                save({ config: { memory: { user_profile_enabled: c } } })
              }}
            />
          </div>
        </div>
      </div>

      {/* Runtime Info */}
      <div className="rounded-xl px-3 py-2.5" style={cardStyle}>
        <div className="flex items-center gap-2 mb-2">
          <span className="size-2 rounded-full bg-green-500 animate-pulse" />
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={mutedStyle}
          >
            运行时
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <span style={mutedStyle}>模型</span>
          <span className="font-mono font-medium">{activeModel || '—'}</span>
          <span style={mutedStyle}>服务提供方</span>
          <span className="font-mono font-medium">
            {PROVIDER_CARDS.find((p) => p.id === activeProvider)?.name ||
              activeProvider ||
              '—'}
          </span>
          <span style={mutedStyle}>配置</span>
          <span className="font-mono font-medium">~/.hermes/config.yaml</span>
        </div>
      </div>
    </div>
  )
}

function _ProfileContent() {
  const { settings: cs, updateSettings: updateCS } = useChatSettingsStore()
  const [profileError, setProfileError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const displayName = getChatProfileDisplayName(cs.displayName)
  const [nameError, setNameError] = useState<string | null>(null)

  function handleNameChange(value: string) {
    if (value.length > 50) {
      setNameError('显示名称过长（最多 50 个字符）')
      return
    }
    setNameError(null)
    updateCS({ displayName: value })
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setProfileError('不支持的文件类型。')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfileError('图片过大（最大 10MB）。')
      return
    }
    setProfileError(null)
    setProcessing(true)
    try {
      const url = URL.createObjectURL(file)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error('Failed'))
        i.src = url
      })
      const max = 128,
        scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale),
        h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      updateCS({
        avatarDataUrl: canvas.toDataURL(
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.82,
        ),
      })
    } catch {
      setProfileError('处理图片失败。')
    } finally {
      setProcessing(false)
    }
  }

  const errorId = 'profile-name-error'

  return (
    <div className="space-y-4">
      <SectionHeader
        title="资料"
        description="你在聊天中显示的身份。"
      />
      <div className={SETTINGS_CARD_CLASS}>
        <div className="flex items-center gap-3">
          <UserAvatar size={44} src={cs.avatarDataUrl} alt={displayName} />
          <div>
            <p className="text-sm font-medium text-primary-900 dark:text-neutral-100">
              {displayName}
            </p>
            <p className="text-xs text-primary-500 dark:text-neutral-400">
              No email connected
            </p>
          </div>
        </div>
      </div>
      <div className={SETTINGS_CARD_CLASS}>
        <Row label="显示名称" description="显示在聊天和侧栏中">
          <div className="w-full max-w-xs">
            <Input
              value={cs.displayName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="用户"
              className="h-8 w-full rounded-lg border-primary-200 text-sm"
              maxLength={50}
              aria-label="显示名称"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? errorId : undefined}
            />
            {nameError && (
              <p
                id={errorId}
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {nameError}
              </p>
            )}
          </div>
        </Row>
        <Row label="头像">
          <div className="flex items-center gap-2">
            <label className="block">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={processing}
                aria-label="上传资料图片"
                className="block max-w-[13rem] cursor-pointer text-xs text-primary-700 dark:text-neutral-300 file:mr-2 file:cursor-pointer file:rounded-lg file:border file:border-primary-200 file:bg-primary-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-primary-900 file:transition-colors hover:file:bg-primary-200 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateCS({ avatarDataUrl: null })}
              disabled={!cs.avatarDataUrl || processing}
              className="h-8 rounded-lg border-primary-200 px-3"
            >
              移除
            </Button>
          </div>
          {profileError && (
            <p className="text-xs text-red-600" role="alert">
              {profileError}
            </p>
          )}
        </Row>
      </div>
    </div>
  )
}

function AppearanceContent() {
  const { settings, updateSettings } = useSettings()

  function handleThemeChange(value: string) {
    const theme = value as SettingsThemeMode
    applyTheme(theme)
    updateSettings({ theme })
  }

  function _badgeClass(color: AccentColor): string {
    if (color === 'orange') return 'bg-orange-500'
    if (color === 'purple') return 'bg-purple-500'
    if (color === 'blue') return 'bg-blue-500'
    return 'bg-green-500'
  }

  function _handleAccentColorChange(selectedAccent: AccentColor) {
    localStorage.setItem('hermes-accent', selectedAccent)
    document.documentElement.setAttribute('data-accent', selectedAccent)
    applyAccentColor(selectedAccent)
    updateSettings({ accentColor: selectedAccent })
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="外观"
        description="主题与配色。"
      />
      {/* Accent color removed — themes control accent */}
      <div className={SETTINGS_CARD_CLASS}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
          明暗模式
        </p>
        <Row
          label="界面明暗"
          description="切换浅色 / 深色，或跟随系统。"
        >
          <ThemeToggle />
        </Row>
      </div>
      <div className={SETTINGS_CARD_CLASS}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
          企业主题
        </p>
        <EnterpriseThemePicker />
      </div>
      <div className={SETTINGS_CARD_CLASS}>
        <Row
          label="系统指标页脚"
          description="显示包含 CPU、内存、磁盘和 Hermes 状态的常驻页脚。"
        >
          <Switch
            checked={settings.showSystemMetricsFooter}
            onCheckedChange={(c) =>
              updateSettings({ showSystemMetricsFooter: c })
            }
            aria-label="显示系统指标页脚"
          />
        </Row>

        {/* Mobile chat nav removed — not relevant for Hermes */}
      </div>
    </div>
  )
}


type ThemePreview = {
  bg: string
  panel: string
  border: string
  accent: string
  text: string
}

const THEME_PREVIEWS_DARK: Record<string, ThemePreview> = {
  'ti-work': { bg: '#1D1D20', panel: '#27272B', border: '#3A3A40', accent: '#148AFF', text: '#FAFAFA' },
  'hermes-os': { bg: '#080c14', panel: '#111827', border: '#1e293b', accent: '#38bdf8', text: '#e2e8f0' },
  'hermes-official': { bg: '#0A0E1A', panel: '#11182A', border: '#24304A', accent: '#6366F1', text: '#E6EAF2' },
  'hermes-classic': { bg: '#0d0f12', panel: '#1a1f26', border: '#2a313b', accent: '#b98a44', text: '#eceff4' },
  'hermes-slate': { bg: '#0d1117', panel: '#1c2128', border: '#30363d', accent: '#7eb8f6', text: '#c9d1d9' },
  'hermes-mono': { bg: '#111111', panel: '#222222', border: '#333333', accent: '#aaaaaa', text: '#e6edf3' },
}

/** Light variants — only themes with a real light implementation (CC Switch style). */
const THEME_PREVIEWS_LIGHT: Partial<Record<string, ThemePreview>> = {
  'ti-work': { bg: '#FFFFFF', panel: '#FFFFFF', border: '#E4E4E7', accent: '#0A84FF', text: '#09090B' },
}

const THEME_PREVIEW_FALLBACK: ThemePreview = {
  bg: '#080c14',
  panel: '#111827',
  border: '#1e293b',
  accent: '#38bdf8',
  text: '#e2e8f0',
}

function getEnterpriseThemes(mode: 'light' | 'dark') {
  const previews =
    mode === 'light' ? THEME_PREVIEWS_LIGHT : THEME_PREVIEWS_DARK
  return THEMES.map((theme) => ({
    ...theme,
    desc: theme.description,
    preview: (previews[theme.id] ?? THEME_PREVIEWS_DARK[theme.id] ?? THEME_PREVIEW_FALLBACK) as ThemePreview,
  }))
}

/** Live-track <html data-mode> so swatches react to the mode toggle. */
function useMode(): 'light' | 'dark' {
  const [mode, setModeState] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-mode') === 'light'
      ? 'light'
      : 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const update = () =>
      setModeState(el.getAttribute('data-mode') === 'light' ? 'light' : 'dark')
    const mo = new MutationObserver(update)
    mo.observe(el, { attributes: true, attributeFilter: ['data-mode'] })
    return () => mo.disconnect()
  }, [])
  return mode
}

function ThemeSwatch({ colors }: { colors: ThemePreview }) {
  return (
    <div
      className="flex h-10 w-full overflow-hidden rounded-md border"
      style={{ borderColor: colors.border, backgroundColor: colors.bg }}
    >
      <div
        className="flex h-full w-4 flex-col gap-0.5 p-0.5"
        style={{ backgroundColor: colors.panel }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 w-full rounded-sm"
            style={{ backgroundColor: colors.border }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-1">
        <div
          className="h-1.5 w-3/4 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.8 }}
        />
        <div
          className="h-1 w-1/2 rounded"
          style={{ backgroundColor: colors.text, opacity: 0.3 }}
        />
        <div
          className="mt-0.5 h-1.5 w-6 rounded-full"
          style={{ backgroundColor: colors.accent }}
        />
      </div>
    </div>
  )
}

function EnterpriseThemePicker() {
  const { updateSettings } = useSettings()
  const mode = useMode()
  const [current, setCurrent] = useState(() => {
    if (typeof window === 'undefined') return 'ti-work'
    return getTheme()
  })
  const themes = getEnterpriseThemes(mode)

  useEffect(() => {
    setCurrent(getTheme())
  }, [])

  function applyEnterpriseTheme(id: ThemeId) {
    setTheme(id)
    // Preserve the user's light/dark/system mode — do not force dark.
    updateSettings({ theme: getStoredThemeMode() })
    setCurrent(id)
  }

  return (
    <div className="space-y-3">
      <div className="grid w-full grid-cols-2 gap-2">
        {themes.map((t) => {
          const isActive = current === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => applyEnterpriseTheme(t.id)}
              className={cn(
                'flex flex-col gap-1.5 rounded-lg border p-2 text-left transition-colors',
                isActive
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-[var(--theme-border)] bg-[var(--theme-card)] hover:bg-[var(--theme-hover)]',
              )}
            >
              <ThemeSwatch colors={t.preview} />
              <div className="flex items-center gap-1">
                <span className="text-xs">
                  <EmojiIcon emoji={t.icon} size={14} />
                </span>
                <span className="text-xs font-semibold text-primary-900 dark:text-neutral-100">
                  {t.label}
                </span>
                {isActive && (
                  <span className="ml-auto text-[9px] font-bold text-accent-600 uppercase tracking-wide">
                    当前
                  </span>
                )}
              </div>
              <p className="text-[10px] text-primary-500 dark:text-neutral-400 leading-tight">
                {t.desc}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function _LoaderContent() {
  const { settings: cs, updateSettings: updateCS } = useChatSettingsStore()
  const styles: Array<{ value: LoaderStyle; label: string }> = [
    { value: 'dots', label: '圆点' },
    { value: 'braille-hermes', label: 'Hermes' },
    { value: 'braille-orbit', label: '轨道' },
    { value: 'braille-breathe', label: '呼吸' },
    { value: 'braille-pulse', label: '脉冲' },
    { value: 'braille-wave', label: '波浪' },
    { value: 'lobster', label: 'Lobster' },
    { value: 'logo', label: '标志' },
  ]
  function getPreset(s: LoaderStyle): BrailleSpinnerPreset | null {
    const m: Record<string, BrailleSpinnerPreset> = {
      'braille-hermes': 'hermes',
      'braille-orbit': 'orbit',
      'braille-breathe': 'breathe',
      'braille-pulse': 'pulse',
      'braille-wave': 'wave',
    }
    return m[s] ?? null
  }
  function Preview({ style }: { style: LoaderStyle }) {
    if (style === 'dots') return <ThreeDotsSpinner />
    if (style === 'lobster')
      return (
        <span className="inline-block text-sm animate-pulse">
          <LobsterIcon size={16} />
        </span>
      )
    if (style === 'logo') return <LogoLoader />
    const p = getPreset(style)
    return p ? (
      <BrailleSpinner
        preset={p}
        size={16}
        speed={120}
        className="text-primary-500"
      />
    ) : (
      <ThreeDotsSpinner />
    )
  }
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
        加载动画
      </p>
      <div className="grid grid-cols-4 gap-2">
        {styles.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => updateCS({ loaderStyle: o.value })}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-lg border px-1.5 py-1.5 transition-colors',
              cs.loaderStyle === o.value
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-[var(--theme-border)] bg-[var(--theme-card)] text-primary-700 hover:bg-[var(--theme-hover)]',
            )}
            aria-pressed={cs.loaderStyle === o.value}
          >
            <span className="flex h-4 items-center justify-center">
              <Preview style={o.value} />
            </span>
            <span className="text-[10px] font-medium leading-3">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ChatContent() {
  const { settings: cs, updateSettings: updateCS } = useChatSettingsStore()
  return (
    <div className="space-y-4">
      <SectionHeader
        title="会话"
        description="消息可见性与回复加载样式。"
      />
      <div className={SETTINGS_CARD_CLASS}>
        <Row
          label="显示工具消息"
          description="在助手回复中展示工具调用详情。"
        >
          <Switch
            checked={cs.showToolMessages}
            onCheckedChange={(c) => updateCS({ showToolMessages: c })}
            aria-label="显示工具消息"
          />
        </Row>
        <Row
          label="显示推理块"
          description="在模型提供时展示推理内容块。"
        >
          <Switch
            checked={cs.showReasoningBlocks}
            onCheckedChange={(c) => updateCS({ showReasoningBlocks: c })}
            aria-label="显示推理块"
          />
        </Row>
      </div>
      {/* Loading animation removed — not relevant for Hermes */}
    </div>
  )
}

function NotificationsContent() {
  const { settings, updateSettings } = useSettings()
  return (
    <div className="space-y-4">
      <SectionHeader
        title="通知"
        description="简单提醒与阈值控制。"
      />
      <div className={SETTINGS_CARD_CLASS}>
        <Row label="启用提醒">
          <Switch
            checked={settings.notificationsEnabled}
            onCheckedChange={(c) => updateSettings({ notificationsEnabled: c })}
            aria-label="启用提醒"
          />
        </Row>
        <Row label="用量阈值">
          <div className="flex w-full max-w-[14rem] items-center gap-2">
            <input
              type="range"
              min={50}
              max={100}
              value={settings.usageThreshold}
              onChange={(e) =>
                updateSettings({ usageThreshold: Number(e.target.value) })
              }
              className="w-full accent-primary-900 dark:accent-primary-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!settings.notificationsEnabled}
              aria-label={`用量阈值：${settings.usageThreshold}%`}
              aria-valuemin={50}
              aria-valuemax={100}
              aria-valuenow={settings.usageThreshold}
            />
            <span className="w-10 text-right text-sm tabular-nums text-primary-700 dark:text-neutral-300">
              {settings.usageThreshold}%
            </span>
          </div>
        </Row>
      </div>
    </div>
  )
}

function _AdvancedContent() {
  const { settings, updateSettings } = useSettings()
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'connected' | 'failed'
  >('idle')
  const [urlError, setUrlError] = useState<string | null>(null)

  function validateAndUpdateUrl(value: string) {
    if (value && value.length > 0) {
      try {
        new URL(value)
        setUrlError(null)
      } catch {
        setUrlError('URL 格式无效')
      }
    } else {
      setUrlError(null)
    }
    updateSettings({ hermesUrl: value })
  }

  async function testConnection() {
    if (urlError) return
    setConnectionStatus('testing')
    try {
      const r = await fetch('/api/ping')
      setConnectionStatus(r.ok ? 'connected' : 'failed')
    } catch {
      setConnectionStatus('failed')
    }
  }

  const urlErrorId = 'hermes-url-error'

  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const importRef = useRef<HTMLInputElement>(null)

  async function triggerBackup() {
    setBackupStatus('running')
    try {
      const r = await fetch('/api/hermes-proxy/api/backup', { method: 'POST' })
      setBackupStatus(r.ok ? 'done' : 'error')
    } catch {
      setBackupStatus('error')
    }
    setTimeout(() => setBackupStatus('idle'), 3000)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    await fetch('/api/hermes-proxy/api/backup/import', { method: 'POST', body })
    if (importRef.current) importRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="高级"
        description="Hermes 端点、连接与数据管理。"
      />
      <div className={SETTINGS_CARD_CLASS}>
        <Row label="Hermes URL" description="用于来自 Studio 的 API 请求">
          <div className="w-full max-w-sm">
            <Input
              type="url"
              placeholder="https://api.hermesworkspace.app"
              value={settings.hermesUrl}
              onChange={(e) => validateAndUpdateUrl(e.target.value)}
              className="h-8 w-full rounded-lg border-primary-200 text-sm"
              aria-label="Hermes URL"
              aria-invalid={!!urlError}
              aria-describedby={urlError ? urlErrorId : undefined}
            />
            {urlError && (
              <p
                id={urlErrorId}
                className="mt-1 text-xs text-red-600"
                role="alert"
              >
                {urlError}
              </p>
            )}
          </div>
        </Row>
        <Row label="API 服务器密钥" description="用于非回环 Hermes 实例的 API_SERVER_KEY（v0.9.0）">
          <Input
            type="password"
            placeholder="sk-…"
            value={settings.hermesApiKey}
            onChange={(e) => updateSettings({ hermesApiKey: e.target.value })}
            className="h-8 w-full max-w-sm rounded-lg border-primary-200 text-sm"
            aria-label="Hermes API server key"
          />
        </Row>
        <Row label="连接状态">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
              connectionStatus === 'connected' &&
                'border-green-500/35 bg-green-500/10 text-green-600',
              connectionStatus === 'failed' &&
                'border-red-500/35 bg-red-500/10 text-red-600',
              connectionStatus === 'testing' &&
                'border-accent-500/35 bg-accent-500/10 text-accent-600',
              connectionStatus === 'idle' &&
                'border-primary-300 bg-primary-100 text-primary-700',
            )}
          >
            {connectionStatus === 'idle'
              ? '未测试'
              : connectionStatus === 'testing'
                ? '测试中...'
                : connectionStatus === 'connected'
                  ? '已连接'
                  : '失败'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void testConnection()}
            disabled={connectionStatus === 'testing' || !!urlError}
            className="h-8 rounded-lg border-primary-200 px-3"
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={16}
              strokeWidth={1.5}
            />
            测试
          </Button>
        </Row>
      </div>
      <div className={SETTINGS_CARD_CLASS}>
        <Row label="备份" description="将配置、会话、技能和记忆导出为快照文件。">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void triggerBackup()}
            disabled={backupStatus === 'running'}
            className="h-8 rounded-lg border-primary-200 px-3"
          >
            {backupStatus === 'running'
              ? '备份中…'
              : backupStatus === 'done'
                ? (<>完成 <EmojiIcon emoji="✓" size={14} /></>)
                : backupStatus === 'error'
                  ? '错误'
                  : '创建备份'}
          </Button>
        </Row>
        <Row label="导入" description="恢复此前创建的备份归档。">
          <div>
            <input
              ref={importRef}
              type="file"
              accept=".zip,.tar,.tar.gz"
              className="hidden"
              onChange={(e) => void handleImport(e)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => importRef.current?.click()}
              className="h-8 rounded-lg border-primary-200 px-3"
            >
              选择文件…
            </Button>
          </div>
        </Row>
      </div>
    </div>
  )
}

// ── Error Boundary ──────────────────────────────────────────────────────

class SettingsErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div>
            <p className="mb-2 text-sm font-medium text-red-500">
              设置加载失败
            </p>
            <button
              onClick={() => this.setState({ error: null })}
              className="text-xs text-primary-600 underline hover:text-primary-900"
            >
              重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Agent Behavior ──────────────────────────────────────────────────────

function AgentBehaviorContent() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: any) => {
        setConfig((d.config?.agent as Record<string, unknown>) || {})
      })
      .catch(() => {})
  }, [])

  const save = async (key: string, value: unknown) => {
    setMsg(null)
    try {
      await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { agent: { [key]: value } } }),
      })
      setConfig((prev) => ({ ...prev, [key]: value }))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg('Failed')
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="智能体行为"
        description="执行限制与工具访问控制。"
      />
      {msg && (
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium',
            msg === 'Saved'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400',
          )}
        >
          {msg === 'Saved' ? '已保存' : msg === 'Failed' ? '失败' : msg}
        </div>
      )}
      <div className={SETTINGS_CARD_CLASS}>
        <Row
          label="最大轮次"
          description="每次请求允许的最大智能体轮次（1-100）"
        >
          <input
            type="number"
            min={1}
            max={100}
            value={Number(config.max_turns) || 50}
            onChange={(e) => save('max_turns', Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-center text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Row>
        <Row label="网关超时" description="超时前等待的秒数">
          <input
            type="number"
            min={10}
            max={600}
            value={Number(config.gateway_timeout) || 120}
            onChange={(e) => save('gateway_timeout', Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-center text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Row>
        <Row label="工具使用策略" description="控制智能体何时必须调用工具">
          <select
            value={String(config.tool_use_enforcement || 'auto')}
            onChange={(e) => save('tool_use_enforcement', e.target.value)}
            className="h-8 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="auto">自动</option>
            <option value="required">必须</option>
            <option value="none">禁用</option>
          </select>
        </Row>
      </div>
    </div>
  )
}

// ── Smart Routing ───────────────────────────────────────────────────────

function SmartRoutingContent() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [models, setModels] = useState<Array<{ id: string; name?: string }>>([])
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: any) => {
        setConfig(
          (d.config?.smart_model_routing as Record<string, unknown>) || {},
        )
      })
      .catch(() => {})
    fetch('/api/models')
      .then((r) => r.json())
      .then((d: any) => {
        setModels(d.models || [])
      })
      .catch(() => {})
  }, [])

  const save = async (key: string, value: unknown) => {
    setMsg(null)
    try {
      await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { smart_model_routing: { [key]: value } },
        }),
      })
      setConfig((prev) => ({ ...prev, [key]: value }))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg('Failed')
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="智能路由"
        description="将简单查询路由到更便宜的模型。"
      />
      {msg && (
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium',
            msg === 'Saved'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400',
          )}
        >
          {msg}
        </div>
      )}
      <div className={SETTINGS_CARD_CLASS}>
        <Row
          label="启用智能路由"
          description="自动路由简单查询"
        >
          <Switch
            checked={config.enabled !== false}
            onCheckedChange={(c) => save('enabled', c)}
          />
        </Row>
        <Row label="廉价模型" description="处理简单查询的模型">
          <select
            value={String(config.cheap_model || '')}
            onChange={(e) => save('cheap_model', e.target.value)}
            className="h-8 max-w-[12rem] rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="">自动</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.id}
              </option>
            ))}
          </select>
        </Row>
        <Row label="最大字符数" description="较短的对话使用廉价模型">
          <input
            type="number"
            min={10}
            max={2000}
            value={Number(config.max_simple_chars) || 200}
            onChange={(e) => save('max_simple_chars', Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-center text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Row>
        <Row
          label="最大词数"
          description="词数更少的对话使用廉价模型"
        >
          <input
            type="number"
            min={1}
            max={500}
            value={Number(config.max_simple_words) || 30}
            onChange={(e) => save('max_simple_words', Number(e.target.value))}
            className="h-8 w-20 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-center text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Row>
      </div>
    </div>
  )
}

// ── Voice (TTS + STT) ──────────────────────────────────────────────────

function VoiceContent() {
  const [tts, setTts] = useState<Record<string, unknown>>({})
  const [stt, setStt] = useState<Record<string, unknown>>({})
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: any) => {
        setTts((d.config?.tts as Record<string, unknown>) || {})
        setStt((d.config?.stt as Record<string, unknown>) || {})
      })
      .catch(() => {})
  }, [])

  const saveTts = async (key: string, value: unknown) => {
    setMsg(null)
    try {
      await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { tts: { [key]: value } } }),
      })
      setTts((prev) => ({ ...prev, [key]: value }))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg('Failed')
    }
  }

  const saveStt = async (key: string, value: unknown) => {
    setMsg(null)
    try {
      await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { stt: { [key]: value } } }),
      })
      setStt((prev) => ({ ...prev, [key]: value }))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg('Failed')
    }
  }

  const ttsProvider = String(tts.provider || 'edge')

  return (
    <div className="space-y-4">
      <SectionHeader
        title="语音"
        description="文字转语音与语音转文字。"
      />
      {msg && (
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium',
            msg === 'Saved'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400',
          )}
        >
          {msg}
        </div>
      )}
      <div className={SETTINGS_CARD_CLASS}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
          文字转语音
        </p>
        <Row label="TTS 服务提供方">
          <select
            value={ttsProvider}
            onChange={(e) => saveTts('provider', e.target.value)}
            className="h-8 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="edge">Edge TTS</option>
            <option value="elevenlabs">ElevenLabs</option>
            <option value="openai">OpenAI TTS</option>
            <option value="neutts">NeuTTS</option>
          </select>
        </Row>
        {ttsProvider === 'openai' && (
          <Row label="音色">
            <select
              value={String(
                (tts.openai as Record<string, unknown>)?.voice || 'nova',
              )}
              onChange={(e) =>
                saveTts('openai', {
                  ...((tts.openai) || {}),
                  voice: e.target.value,
                })
              }
              className="h-8 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              {['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].map(
                (v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ),
              )}
            </select>
          </Row>
        )}
      </div>
      <div className={SETTINGS_CARD_CLASS}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-500">
          语音转文字
        </p>
        <Row label="启用 STT">
          <Switch
            checked={stt.enabled !== false}
            onCheckedChange={(c) => saveStt('enabled', c)}
          />
        </Row>
        <Row label="STT 服务提供方">
          <select
            value={String(stt.provider || 'local')}
            onChange={(e) => saveStt('provider', e.target.value)}
            className="h-8 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="local">Local (Whisper)</option>
            <option value="openai">OpenAI Whisper</option>
          </select>
        </Row>
      </div>
    </div>
  )
}

// ── Display ─────────────────────────────────────────────────────────────

function DisplayContent() {
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hermes-config')
      .then((r) => r.json())
      .then((d: any) => {
        setConfig((d.config?.display as Record<string, unknown>) || {})
      })
      .catch(() => {})
  }, [])

  const save = async (key: string, value: unknown) => {
    setMsg(null)
    try {
      await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: { display: { [key]: value } } }),
      })
      setConfig((prev) => ({ ...prev, [key]: value }))
      setMsg('Saved')
      setTimeout(() => setMsg(null), 2000)
    } catch {
      setMsg('Failed')
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="显示"
        description="智能体回复风格与输出偏好。"
      />
      {msg && (
        <div
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-medium',
            msg === 'Saved'
              ? 'bg-green-500/15 text-green-400'
              : 'bg-red-500/15 text-red-400',
          )}
        >
          {msg}
        </div>
      )}
      <div className={SETTINGS_CARD_CLASS}>
        <Row label="个性" description="智能体回复风格">
          <select
            value={String(config.personality || 'default')}
            onChange={(e) => save('personality', e.target.value)}
            className="h-8 rounded-lg border border-primary-200 bg-primary-50 px-2 text-sm text-primary-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="default">默认</option>
            <option value="concise">简洁</option>
            <option value="verbose">详细</option>
            <option value="creative">有创造力</option>
          </select>
        </Row>
        <Row label="流式输出" description="实时流式返回回复">
          <Switch
            checked={config.streaming !== false}
            onCheckedChange={(c) => save('streaming', c)}
          />
        </Row>
        <Row
          label="显示推理"
          description="展示模型的思考过程"
        >
          <Switch
            checked={config.show_reasoning !== false}
            onCheckedChange={(c) => save('show_reasoning', c)}
          />
        </Row>
        <Row label="显示费用" description="显示每次回复的 Token 费用">
          <Switch
            checked={config.show_cost === true}
            onCheckedChange={(c) => save('show_cost', c)}
          />
        </Row>
        <Row label="紧凑模式" description="压缩回复间距">
          <Switch
            checked={config.compact === true}
            onCheckedChange={(c) => save('compact', c)}
          />
        </Row>
      </div>
    </div>
  )
}

// ── Main Dialog ─────────────────────────────────────────────────────────

const CONTENT_MAP: Record<SectionId, () => React.JSX.Element> = {
  hermes: HermesContent,
  agent: AgentBehaviorContent,
  routing: SmartRoutingContent,
  voice: VoiceContent,
  display: DisplayContent,
  appearance: AppearanceContent,
  chat: ChatContent,
  notifications: NotificationsContent,
}

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSection?: SectionId
}

export function SettingsDialog({
  open,
  onOpenChange,
  initialSection = 'hermes',
}: SettingsDialogProps) {
  const [active, setActive] = useState<SectionId>(initialSection)
  const [mobileView, setMobileView] = useState<'nav' | 'content'>('nav')
  const ActiveContent = CONTENT_MAP[active]

  useEffect(() => {
    if (open) {
      setActive(initialSection)
      setMobileView('nav')
    }
  }, [initialSection, open])

  function handleSectionSelect(sectionId: SectionId) {
    setActive(sectionId)
    setMobileView('content')
  }

  return (
    <DialogRoot open={open} onOpenChange={onOpenChange}>
      <DialogContent className="inset-0 h-full w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 p-0 shadow-xl md:inset-auto md:left-1/2 md:top-1/2 md:h-[min(88dvh,740px)] md:min-h-[520px] md:w-full md:max-w-3xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[20px] md:border md:border-[var(--theme-border)] bg-[var(--theme-panel)]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-4 md:rounded-t-[20px] md:px-5">
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--theme-text)] dark:text-neutral-100">
                设置
              </DialogTitle>
              <DialogDescription className="sr-only">
                配置 Ti Work
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="rounded-full text-primary-500 hover:bg-primary-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  aria-label="关闭"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={18}
                    strokeWidth={1.5}
                  />
                </Button>
              }
            />
          </div>

          <SettingsErrorBoundary>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside
                className={cn(
                  'w-full bg-primary-50/60 p-2 md:w-44 md:shrink-0 md:border-r md:border-primary-200',
                  mobileView === 'content' && 'hidden md:block',
                )}
              >
                <nav className="space-y-1">
                  {SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSectionSelect(s.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-primary-600 transition-colors hover:bg-primary-100',
                        active === s.id &&
                          'bg-accent-50 font-medium text-accent-700',
                      )}
                    >
                      <HugeiconsIcon
                        icon={s.icon}
                        size={16}
                        strokeWidth={1.5}
                      />
                      {s.label}
                    </button>
                  ))}
                </nav>
              </aside>
              <div
                className={cn(
                  'min-w-0 flex-1 overflow-y-auto p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:p-5 md:pb-5',
                  mobileView === 'nav' && 'hidden md:block',
                )}
              >
                <div className="mb-3 md:hidden">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileView('nav')}
                    className="h-8 gap-1.5 rounded-lg px-2 text-primary-600 hover:bg-primary-100"
                  >
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      size={16}
                      strokeWidth={1.5}
                    />
                    返回
                  </Button>
                </div>
                <ActiveContent />
              </div>
            </div>
          </SettingsErrorBoundary>

          <div className="sticky bottom-0 z-10 border-t border-[var(--theme-border)] bg-[var(--theme-card)] px-4 py-3 text-xs text-[var(--theme-muted)] dark:text-neutral-400 md:rounded-b-[20px] md:px-5">
            更改自动保存。{' '}
            <a
              href="/settings"
              className="ml-2 font-medium underline underline-offset-2 hover:text-primary-700 dark:hover:text-neutral-200"
            >
              全部设置 →
            </a>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
