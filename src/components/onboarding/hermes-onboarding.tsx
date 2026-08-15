'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { ProviderLogo } from '@/components/provider-logo'
import { EmojiIcon } from '@/components/emoji-icon'

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

const ONBOARDING_KEY = 'hermes-onboarding-complete'

type Step = 'welcome' | 'connect' | 'provider' | 'test' | 'done'

type GatewayStatusResponse = {
  capabilities?: {
    health?: boolean
    chatCompletions?: boolean
    models?: boolean
    streaming?: boolean
    sessions?: boolean
    skills?: boolean
    memory?: boolean
    config?: boolean
    jobs?: boolean
  }
  hermesUrl?: string
}

const PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '/providers/deepseek.png',
    desc: '国内模型，需要 API Key',
    authType: 'api_key',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-v4-flash',
  },
  {
    id: 'dashscope',
    name: '通义千问 Qwen',
    logo: '/providers/qwen.png',
    desc: '阿里云百炼，需要 API Key',
    authType: 'api_key',
    envKey: 'DASHSCOPE_API_KEY',
    defaultModel: 'qwen-max',
  },
  {
    id: 'nous',
    name: 'Nous 门户',
    logo: '/providers/nous.png',
    desc: 'OAuth 免费接入',
    authType: 'oauth',
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex',
    logo: '/providers/openai.png',
    desc: 'ChatGPT Pro 免费使用',
    authType: 'oauth',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    logo: '/providers/anthropic.png',
    desc: '需要 API Key',
    authType: 'api_key',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-6',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    logo: '/providers/openrouter.png',
    desc: '需要 API Key',
    authType: 'api_key',
    envKey: 'OPENROUTER_API_KEY',
    defaultModel: 'openrouter/auto',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    logo: '/providers/ollama.png',
    desc: '本地模型，无需密钥',
    authType: 'none',
  },
  {
    id: 'custom',
    name: '自定义（兼容 OpenAI）',
    logo: '/providers/openai.png',
    desc: '任意 OpenAI 兼容接口',
    authType: 'custom',
  },
]

function getEnhancedFeatureNames(
  capabilities?: GatewayStatusResponse['capabilities'],
): Array<string> {
  if (!capabilities) return []
  const features: Array<{ enabled?: boolean; label: string }> = [
    { enabled: capabilities.sessions, label: '会话' },
    { enabled: capabilities.skills, label: '技能' },
    { enabled: capabilities.memory, label: '记忆' },
    { enabled: capabilities.config, label: '应用内配置' },
    { enabled: capabilities.jobs, label: '任务' },
  ]

  return features
    .filter((feature) => feature.enabled)
    .map((feature) => feature.label)
}

export function HermesOnboarding() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState<Step>('welcome')
  const [backendStatus, setBackendStatus] = useState<
    'idle' | 'checking' | 'ready' | 'error'
  >('idle')
  const [backendInfo, setBackendInfo] = useState<GatewayStatusResponse | null>(
    null,
  )
  const [backendMessage, setBackendMessage] = useState('')
  const [autoStarting, setAutoStarting] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [availableModels, setAvailableModels] = useState<Array<string>>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [testMessage, setTestMessage] = useState('')
  const [configuredModel, setConfiguredModel] = useState('')

  const [oauthStep, setOauthStep] = useState<
    'idle' | 'loading' | 'waiting' | 'success' | 'error'
  >('idle')
  const [oauthUserCode, setOauthUserCode] = useState('')
  const [oauthVerificationUrl, setOauthVerificationUrl] = useState('')
  const [oauthError, setOauthError] = useState('')
  const oauthPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const provider = PROVIDERS.find((p) => p.id === selectedProvider)
  const needsApiKey =
    provider?.authType === 'api_key' || provider?.authType === 'custom'
  const needsBaseUrl =
    provider?.id === 'ollama' || provider?.authType === 'custom'
  const isOAuth = provider?.authType === 'oauth'
  const capabilities = backendInfo?.capabilities
  const canEditConfig = Boolean(capabilities?.config)
  const enhancedFeatures = getEnhancedFeatureNames(capabilities)
  const canFetchModels = Boolean(capabilities?.models)
  const backendSupportsChat = Boolean(capabilities?.chatCompletions)

  const loadCurrentConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes-config')
      if (!res.ok) return
      const data = (await res.json()) as {
        activeModel?: string
        activeProvider?: string
      }
      if (data.activeModel) {
        const normalizedModel = stripProviderPrefix(data.activeModel)
        setConfiguredModel(normalizedModel)
        setSelectedModel((current) => current || normalizedModel)
      }
      if (data.activeProvider) {
        setSelectedProvider((current) => current || data.activeProvider || null)
      }
    } catch {}
  }, [])

  const loadModels = useCallback(async () => {
    if (!canFetchModels) return
    try {
      const modelsRes = await fetch('/api/models')
      if (!modelsRes.ok) return
      const modelsData = (await modelsRes.json()) as {
        data?: Array<{ id?: string }>
        models?: Array<{ id?: string }>
      }
      const rawModels = modelsData.data || modelsData.models || []
      const models = rawModels
        .map((model) => (typeof model.id === 'string' ? model.id : ''))
        .filter(Boolean)
        .slice(0, 20)

      setAvailableModels(models)
      setSelectedModel(
        (current) => current || stripProviderPrefix(models[0] || ''),
      )
    } catch {
      setAvailableModels([])
    }
  }, [canFetchModels])

  const checkBackend = useCallback(async () => {
    setBackendStatus('checking')
    setBackendMessage('')

    try {
      const res = await fetch('/api/gateway-status')
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = (await res.json()) as GatewayStatusResponse
      setBackendInfo(data)

      if (data.capabilities?.chatCompletions) {
        setBackendStatus('ready')
        setBackendMessage(
          data.capabilities.sessions
            ? '后端已连接。基础对话可用，Hermes 执行引擎（网关）增强功能已就绪。'
            : '后端已连接。基础对话已就绪。',
        )
        return
      }

      if (data.capabilities?.health) {
        setBackendStatus('error')
        setBackendMessage(
          '后端可达，但 /v1/chat/completions 接口尚未就绪。',
        )
        return
      }

      setBackendStatus('error')
      setBackendMessage('尚未检测到兼容的后端。')
    } catch (err) {
      setBackendInfo(null)
      setBackendStatus('error')
      setBackendMessage(
        err instanceof Error ? err.message : '连接检查失败',
      )
    }
  }, [])

  /** 一键启动执行引擎：由应用后台执行启动命令，用户无需手动操作。 */
  const handleAutoStart = useCallback(async () => {
    if (autoStarting) return
    setAutoStarting(true)
    setBackendStatus('checking')
    setBackendMessage('正在启动执行引擎…')

    try {
      const res = await fetch('/api/start-agent', {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        message?: string
      }
      if (!data.ok) {
        setBackendStatus('error')
        setBackendMessage(data.error || '启动失败，请稍后重试。')
        return
      }

      // 等待引擎就绪：首次安装会经历 安装→配置→启动，最长约 10 分钟
      for (let i = 0; i < 300; i += 1) {
        await new Promise((resolveWait) => setTimeout(resolveWait, 2_000))
        try {
          // 安装进度 → 展示当前阶段
          const progRes = await fetch('/api/engine-bootstrap', {
            cache: 'no-store',
          })
          if (progRes.ok) {
            const progress = (await progRes.json()) as {
              phase?: string
              currentStage?: string | null
              stageIndex?: number
              stageCount?: number
              error?: string | null
            }
            if (progress.phase === 'failed') {
              setBackendStatus('error')
              setBackendMessage(progress.error || '执行引擎安装失败，请重试。')
              return
            }
            if (
              progress.phase === 'installing' ||
              progress.phase === 'configuring' ||
              progress.phase === 'starting'
            ) {
              setBackendMessage(
                progress.currentStage
                  ? `正在安装执行引擎（${progress.stageIndex ?? 0}/${progress.stageCount ?? 0}）：${progress.currentStage}`
                  : '正在安装执行引擎…',
              )
            }
          }
        } catch {
          // 轮询失败不中断
        }

        try {
          const statusRes = await fetch('/api/gateway-status')
          if (!statusRes.ok) continue
          const status = (await statusRes.json()) as GatewayStatusResponse
          if (status.capabilities?.chatCompletions) {
            setBackendInfo(status)
            setBackendStatus('ready')
            setBackendMessage('执行引擎已启动，后端已连接。')
            return
          }
        } catch {
          // 引擎尚未就绪，继续轮询
        }
      }

      setBackendStatus('error')
      setBackendMessage('执行引擎已启动，但尚未就绪。请稍后点击「重试」。')
    } catch {
      setBackendStatus('error')
      setBackendMessage('启动请求失败，请重试。')
    } finally {
      setAutoStarting(false)
    }
  }, [autoStarting])

  const saveProviderConfig = useCallback(async () => {
    if (!selectedProvider) return true
    if (!canEditConfig) return true
    setSaving(true)
    setSaveError('')

    try {
      const prov = PROVIDERS.find((p) => p.id === selectedProvider)
      // 扁平格式（与设置弹窗一致）：provider + model 顶层键，网关与 GET 均按此读取
      const defaultModel = prov?.defaultModel ?? ''
      const body: Record<string, unknown> = {
        config: {
          provider: selectedProvider,
          ...(defaultModel ? { model: defaultModel } : {}),
        },
      }

      if (prov?.envKey && apiKey) {
        body.env = { [prov.envKey]: apiKey }
      }
      if (baseUrl) {
        body.config = { model: { provider: selectedProvider, baseUrl } }
      }

      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`保存失败：${res.status}`)

      await loadCurrentConfig()
      await loadModels()
      return true
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    apiKey,
    baseUrl,
    canEditConfig,
    loadCurrentConfig,
    loadModels,
    selectedProvider,
  ])

  const saveModelSelection = useCallback(async () => {
    const modelToSave = stripProviderPrefix(selectedModel || configuredModel)
    if (!modelToSave) return true

    setConfiguredModel(modelToSave)

    if (!canEditConfig || !selectedProvider) return true

    try {
      const res = await fetch('/api/hermes-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            model: modelToSave,
            provider: selectedProvider,
          },
        }),
      })
      if (!res.ok) throw new Error(`保存失败：${res.status}`)
      return true
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '模型保存失败')
      return false
    }
  }, [canEditConfig, configuredModel, selectedModel, selectedProvider])

  const testConnection = useCallback(async () => {
    setTestStatus('testing')
    setTestMessage('')

    try {
      const res = await fetch('/api/send-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: 'new',
          friendlyId: 'new',
          message:
            '请用一句话确认后端连接是否正常。',
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const reader = res.body?.getReader()
      if (!reader) throw new Error('未返回数据流')

      const decoder = new TextDecoder()
      let text = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const matches = chunk.match(/(?:delta|text|content)":"([^"]+)"/g)
        if (matches) {
          for (const match of matches) {
            text += match.replace(/.*":"/, '').replace(/"$/, '')
          }
        }
      }

      setTestMessage(text.slice(0, 240) || '对话测试成功。')
      setTestStatus('success')
      void checkBackend()
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : '连接失败')
      setTestStatus('error')
    }
  }, [checkBackend])

  const startNousOAuth = useCallback(async () => {
    setOauthStep('loading')
    setOauthError('')

    try {
      const res = await fetch('/api/oauth/device-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'nous' }),
      })
      const data = (await res.json()) as {
        device_code?: string
        user_code?: string
        verification_uri_complete?: string
        interval?: number
        error?: string
      }

      if (!res.ok || data.error) {
        setOauthError(data.error || 'OAuth 启动失败')
        setOauthStep('error')
        return
      }

      setOauthUserCode(data.user_code || '')
      setOauthVerificationUrl(data.verification_uri_complete || '')
      setOauthStep('waiting')

      if (data.verification_uri_complete) {
        window.open(data.verification_uri_complete, '_blank')
      }

      const intervalMs = Math.max((data.interval || 5) * 1000, 3000)
      oauthPollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch('/api/oauth/poll-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'nous',
              deviceCode: data.device_code,
            }),
          })
          const pollData = (await pollRes.json()) as {
            status: string
            message?: string
          }

          if (pollData.status === 'success') {
            if (oauthPollRef.current) clearInterval(oauthPollRef.current)
            setOauthStep('success')
            await saveProviderConfig()
            await loadModels()
            return
          }

          if (pollData.status === 'error') {
            if (oauthPollRef.current) clearInterval(oauthPollRef.current)
            setOauthError(pollData.message || '认证失败')
            setOauthStep('error')
          }
        } catch {}
      }, intervalMs)
    } catch (err) {
      setOauthError(
        err instanceof Error ? err.message : 'OAuth 启动失败',
      )
      setOauthStep('error')
    }
  }, [loadModels, saveProviderConfig])

  // 首启判定：仅当从未完成过引导 且 当前没有任何已配置的模型提供方时弹出。
  // 已配置（如老用户升级）时直接标记完成并跳过引导，避免打断使用。
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(ONBOARDING_KEY)) return

    let cancelled = false

    void (async () => {
      let configured = false
      try {
        const res = await fetch('/api/hermes-config', {
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = (await res.json()) as {
            activeModel?: string
            activeProvider?: string
            providers?: Array<{
              authType?: string
              configured?: boolean
              authSource?: string
            }>
          }
          const hasActiveModel = Boolean(
            data.activeModel && data.activeProvider,
          )
          const hasKeyProvider = (data.providers ?? []).some(
            (p) =>
              p.authType === 'api_key' &&
              p.configured === true &&
              p.authSource !== 'none',
          )
          configured = hasActiveModel || hasKeyProvider
        }
      } catch {
        // 检测失败时保守弹出引导（无后端更需指引）
      }

      if (cancelled) return
      if (configured) {
        localStorage.setItem(ONBOARDING_KEY, 'true')
      } else {
        setShow(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (oauthPollRef.current) clearInterval(oauthPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (oauthPollRef.current) clearInterval(oauthPollRef.current)
    setOauthStep('idle')
    setOauthUserCode('')
    setOauthVerificationUrl('')
    setOauthError('')
  }, [selectedProvider])

  useEffect(() => {
    if (show) {
      void loadCurrentConfig()
    }
  }, [loadCurrentConfig, show])

  // 支持页面内"连接 Hermes 网关"按钮触发引导（如定时任务等增强功能的解锁入口）
  useEffect(() => {
    const openFromEvent = () => {
      setShow(true)
      setStep('connect')
      void checkBackend()
    }
    window.addEventListener('hermes:open-onboarding', openFromEvent)
    return () =>
      window.removeEventListener('hermes:open-onboarding', openFromEvent)
  }, [checkBackend])

  const complete = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    setShow(false)
  }, [])

  if (!show) return null

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-card)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-text)',
  }
  const mutedStyle: React.CSSProperties = { color: 'var(--theme-muted)' }
  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--theme-bg)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-text)',
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center px-4"
      style={{
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.97 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-md rounded-2xl p-8"
          style={cardStyle}
        >
          {step !== 'done' && (
            <button
              type="button"
              aria-label="关闭引导"
              onClick={complete}
              className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-lg leading-none text-[var(--theme-muted)] transition-colors hover:bg-black/10 hover:text-[var(--theme-text)]"
            >
              ×
            </button>
          )}
          {step === 'welcome' && (
            <div className="space-y-4 text-center">
              <img
                src="/ti-work-logo.svg"
                alt="Ti Work"
                className="mx-auto size-20 rounded-2xl"
                style={{
                  filter: 'drop-shadow(0 8px 24px rgba(99,102,241,0.3))',
                }}
              />
              <h2 className="text-xl font-bold">欢迎使用 Ti Work</h2>
              <p className="text-sm" style={mutedStyle}>
                兼容任意 OpenAI 接口的后端。接入 Hermes 执行引擎（网关）后，会话、记忆、技能等增强功能将自动解锁。
              </p>
              <button
                onClick={() => {
                  setStep('connect')
                  void checkBackend()
                }}
                className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
              >
                连接后端
              </button>
              <button onClick={complete} className="text-xs" style={mutedStyle}>
                跳过设置
              </button>
            </div>
          )}

          {step === 'connect' && (
            <div className="space-y-4 text-center">
              <div className="text-4xl">
                <EmojiIcon emoji="🔌" size={40} />
              </div>
              <h2 className="text-lg font-bold">连接你的后端</h2>
              <p className="text-sm" style={mutedStyle}>
                先确认 Ti Work 能连通你的 OpenAI 兼容后端。
              </p>

              {backendStatus === 'checking' && (
                <div
                  className="flex items-center justify-center gap-2 text-sm"
                  style={mutedStyle}
                >
                  <span className="size-2 animate-pulse rounded-full bg-accent-500" />
                  {autoStarting ? '正在启动执行引擎…' : '正在检查后端能力...'}
                </div>
              )}

              {backendStatus === 'ready' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-green-500">
                    <span className="size-2 rounded-full bg-green-500" />
                    {backendMessage}
                  </div>
                  <div
                    className="rounded-xl p-3 text-left text-xs"
                    style={cardStyle}
                  >
                    <p style={mutedStyle}>后端地址</p>
                    <p className="mt-1 font-mono">
                      {backendInfo?.hermesUrl || '自动配置'}
                    </p>
                  </div>
                </div>
              )}

              {backendStatus === 'error' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-red-400">
                    <span className="size-2 rounded-full bg-red-500" />
                    {backendMessage}
                  </div>
                  <div
                    className="rounded-xl p-3 text-left text-xs"
                    style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
                  >
                    <p className="font-medium text-white">
                      Hermes 网关是什么？
                    </p>
                    <p className="mt-2" style={mutedStyle}>
                      Ti Work 需要一个「模型后端」才能对话。Hermes 网关是
                      Ti Work 的执行引擎：连接后，定时任务、会话、记忆等增强功能会自动解锁。
                    </p>
                    <p className="mt-2" style={mutedStyle}>
                      点击下方按钮，Ti Work 会自动在后台启动执行引擎，无需手动配置。
                    </p>
                  </div>
                  <button
                    onClick={() => void handleAutoStart()}
                    disabled={autoStarting}
                    className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-60"
                  >
                    {autoStarting ? '正在启动…' : '一键启动执行引擎'}
                  </button>
                </div>
              )}

              {backendStatus === 'error' ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep('welcome')}
                      className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      ← 返回
                    </button>
                    <button
                      onClick={() => void checkBackend()}
                      disabled={autoStarting}
                      className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      重试
                    </button>
                  </div>
                  <button
                    onClick={complete}
                    className="mx-auto block text-xs"
                    style={mutedStyle}
                  >
                    暂时跳过，直接进入工作区
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => void checkBackend()}
                    disabled={backendStatus === 'checking'}
                    className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    重试
                  </button>
                  <button
                    onClick={() => {
                      setStep('provider')
                      void loadModels()
                    }}
                    disabled={backendStatus !== 'ready'}
                    className="flex-1 rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                  >
                    继续
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'provider' && (
            <div className="space-y-4">
              <h2 className="text-center text-lg font-bold">
                选择模型服务商与模型
              </h2>
              <p className="text-center text-xs" style={mutedStyle}>
                {canEditConfig
                  ? '在此保存服务商设置，然后选择模型后再测试对话。'
                  : '该后端在 Ti Work 之外管理服务商设置。确认你要使用的模型后测试对话。'}
              </p>

              <div className="rounded-xl p-3 text-xs" style={cardStyle}>
                <p style={mutedStyle}>后端模式</p>
                <p className="mt-1">
                  {backendInfo?.capabilities?.sessions
                    ? '已检测到 Hermes 执行引擎（网关）'
                    : '便携式 OpenAI 兼容后端'}
                </p>
                {configuredModel ? (
                  <p className="mt-2" style={mutedStyle}>
                    当前模型：{' '}
                    <span className="font-mono text-accent-400">
                      {configuredModel}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProvider(p.id)
                      setApiKey('')
                      setBaseUrl('')
                      setSaveError('')
                    }}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all',
                      selectedProvider === p.id ? 'ring-2 ring-accent-500' : '',
                    )}
                    style={cardStyle}
                  >
                    <ProviderLogo
                      provider={p.id}
                      size={40}
                      className="shrink-0 rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">{p.name}</div>
                      <div className="text-xs" style={mutedStyle}>
                        {p.desc}
                      </div>
                    </div>
                    {selectedProvider === p.id ? (
                      <span className="ml-auto size-2.5 shrink-0 rounded-full bg-green-500" />
                    ) : null}
                  </button>
                ))}
              </div>

              {selectedProvider &&
                isOAuth &&
                selectedProvider === 'nous' &&
                canEditConfig && (
                  <div
                    className="space-y-3 rounded-xl p-4 text-left"
                    style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
                  >
                    {oauthStep === 'idle' && (
                      <button
                        onClick={startNousOAuth}
                        className="w-full rounded-lg bg-accent-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
                      >
                        通过 Nous 门户连接
                      </button>
                    )}
                    {oauthStep === 'loading' && (
                      <div
                        className="flex items-center justify-center gap-2 py-2 text-sm"
                        style={mutedStyle}
                      >
                        <span className="size-2 animate-pulse rounded-full bg-accent-500" />
                        正在启动 OAuth 授权...
                      </div>
                    )}
                    {oauthStep === 'waiting' && (
                      <div className="space-y-3">
                        <div
                          className="flex items-center gap-2 text-sm"
                          style={mutedStyle}
                        >
                          <span className="size-2 animate-pulse rounded-full bg-yellow-400" />
                          等待授权确认...
                        </div>
                        {oauthUserCode ? (
                          <div className="space-y-1 text-center">
                            <p className="text-xs" style={mutedStyle}>
                              授权码
                            </p>
                            <p className="text-2xl font-mono font-bold tracking-widest">
                              {oauthUserCode}
                            </p>
                          </div>
                        ) : null}
                        {oauthVerificationUrl ? (
                          <button
                            onClick={() =>
                              window.open(oauthVerificationUrl, '_blank')
                            }
                            className="w-full rounded-lg border py-2 text-xs font-medium"
                            style={{ borderColor: 'var(--theme-border)' }}
                          >
                            打开 Nous 门户 ↗
                          </button>
                        ) : null}
                      </div>
                    )}
                    {oauthStep === 'success' && (
                      <div className="flex items-center gap-2 text-sm text-green-500">
                        <span>
                          <EmojiIcon emoji="✓" size={14} />
                        </span>
                        <span>认证成功。</span>
                      </div>
                    )}
                    {oauthStep === 'error' && (
                      <div className="space-y-2">
                        <p className="text-xs text-red-400">
                          {oauthError || '认证失败'}
                        </p>
                        <button
                          onClick={startNousOAuth}
                          className="w-full rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
                        >
                          重试
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {selectedProvider &&
                isOAuth &&
                selectedProvider === 'openai-codex' &&
                canEditConfig && (
                  <div
                    className="space-y-2 rounded-xl p-4 text-left"
                    style={{ ...cardStyle, borderColor: 'var(--theme-border)' }}
                  >
                    <p className="text-sm font-medium">在终端中执行</p>
                    <div
                      className="rounded-lg px-3 py-2 font-mono text-xs"
                      style={{ background: 'rgba(0,0,0,0.2)' }}
                    >
                      hermes auth login openai-codex
                    </div>
                    <p className="text-xs" style={mutedStyle}>
                      登录流程完成后，点击下方刷新服务商设置。
                    </p>
                    <button
                      onClick={async () => {
                        await saveProviderConfig()
                        await loadModels()
                      }}
                      className="w-full rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
                    >
                      我已认证
                    </button>
                  </div>
                )}

              {selectedProvider && (needsApiKey || needsBaseUrl) && (
                <div className="space-y-2 pt-1">
                  {needsBaseUrl ? (
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={mutedStyle}
                      >
                        {selectedProvider === 'ollama'
                          ? 'Ollama 地址'
                          : '基础地址'}
                      </label>
                      <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder={
                          selectedProvider === 'ollama'
                            ? 'http://localhost:11434'
                            : 'https://api.example.com/v1'
                        }
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                        style={inputStyle}
                      />
                    </div>
                  ) : null}
                  {needsApiKey ? (
                    <div>
                      <label
                        className="mb-1 block text-xs font-medium"
                        style={mutedStyle}
                      >
                        API 密钥
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                        style={inputStyle}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={mutedStyle}
                >
                  模型
                </label>
                {availableModels.length > 0 ? (
                  <select
                    value={selectedModel}
                    onChange={(e) =>
                      setSelectedModel(stripProviderPrefix(e.target.value))
                    }
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                    style={inputStyle}
                  >
                    {availableModels.map((model) => (
                      <option key={model} value={model}>
                        {stripProviderPrefix(model)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder={configuredModel || 'gpt-4.1'}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                    style={inputStyle}
                  />
                )}
                <p className="mt-2 text-xs" style={mutedStyle}>
                  {canFetchModels
                    ? '模型列表已从后端获取。'
                    : '如果后端不提供 /v1/models 接口，请手动输入模型名称。'}
                </p>
              </div>

              {!canEditConfig ? (
                <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  该后端不支持在应用内编辑服务商设置，这并非必需。如果后端已配置完成，可直接进入对话测试。
                </div>
              ) : null}

              {saveError ? (
                <p className="text-xs text-red-400">{saveError}</p>
              ) : null}

              <div className="flex gap-2">
                {selectedProvider &&
                canEditConfig &&
                (needsApiKey || needsBaseUrl) ? (
                  <button
                    onClick={() => void saveProviderConfig()}
                    disabled={
                      saving || (needsApiKey && !apiKey && !needsBaseUrl)
                    }
                    className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {saving ? '保存中...' : '保存设置'}
                  </button>
                ) : null}
                <button
                  onClick={async () => {
                    let ok = true
                    if (
                      selectedProvider &&
                      canEditConfig &&
                      (!isOAuth || oauthStep === 'success')
                    ) {
                      ok = await saveProviderConfig()
                    }
                    if (ok) {
                      ok = await saveModelSelection()
                    }
                    if (ok) {
                      setStep('test')
                      setTestStatus('idle')
                      setTestMessage('')
                    }
                  }}
                  disabled={!backendSupportsChat}
                  className="flex-1 rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
                >
                  继续 →
                </button>
              </div>
            </div>
          )}

          {step === 'test' && (
            <div className="space-y-4 text-center">
              <div className="text-4xl">
                <EmojiIcon emoji="🧪" size={40} />
              </div>
              <h2 className="text-lg font-bold">测试对话</h2>
              <p className="text-sm" style={mutedStyle}>
                先确认基础对话可用。Hermes 增强功能为可选能力，后端支持时自动出现。
              </p>

              <div
                className="rounded-xl p-3 text-left text-xs"
                style={cardStyle}
              >
                <p style={mutedStyle}>后端</p>
                <p className="mt-1 font-mono">
                  {backendInfo?.hermesUrl || '自动配置'}
                </p>
                {selectedModel || configuredModel ? (
                  <p className="mt-2" style={mutedStyle}>
                    模型：{' '}
                    <span className="font-mono text-accent-400">
                      {stripProviderPrefix(selectedModel || configuredModel)}
                    </span>
                  </p>
                ) : null}
              </div>

              {testStatus === 'idle' ? (
                <button
                  onClick={testConnection}
                  className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
                >
                  发送测试消息
                </button>
              ) : null}

              {testStatus === 'testing' ? (
                <div
                  className="flex items-center justify-center gap-2 text-sm"
                  style={mutedStyle}
                >
                  <span className="size-2 animate-pulse rounded-full bg-accent-500" />
                  正在等待后端响应...
                </div>
              ) : null}

              {testStatus === 'success' ? (
                <div className="space-y-3">
                  <div
                    className="rounded-xl p-3 text-left text-sm"
                    style={cardStyle}
                  >
                    <span className="font-medium text-green-500">
                      助手：
                    </span>{' '}
                    <span>{testMessage}</span>
                  </div>
                  <button
                    onClick={() => setStep('done')}
                    className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
                  >
                    继续
                  </button>
                </div>
              ) : null}

              {testStatus === 'error' ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-left text-sm">
                    <p className="mb-1 font-medium text-red-400">
                      对话测试失败
                    </p>
                    <p className="text-xs" style={mutedStyle}>
                      {testMessage}
                    </p>
                    {testMessage.includes('401') ||
                    testMessage.toLowerCase().includes('key') ? (
                      <p className="mt-2 text-xs text-yellow-400">
                        请检查服务商凭据与账号权限。
                      </p>
                    ) : testMessage.toLowerCase().includes('model') ? (
                      <p className="mt-2 text-xs text-yellow-400">
                        请确认所选模型在该后端存在。
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-yellow-400">
                        请确认后端仍在运行且可从 Ti Work 访问。
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={testConnection}
                      className="flex-1 rounded-lg bg-accent-500 py-2 text-xs font-medium text-white"
                    >
                      重试
                    </button>
                    <button
                      onClick={() => setStep('provider')}
                      className="flex-1 rounded-lg border py-2 text-xs font-medium"
                      style={{ borderColor: 'var(--theme-border)' }}
                    >
                      ← 返回
                    </button>
                  </div>
                  <button
                    onClick={() => setStep('done')}
                    className="mx-auto block text-xs"
                    style={mutedStyle}
                  >
                    暂时跳过
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-4 text-center">
              <div className="text-5xl">
                <EmojiIcon emoji="🎉" size={48} />
              </div>
              <h2 className="text-xl font-bold">工作区就绪</h2>
              <p className="text-sm" style={mutedStyle}>
                基础对话已配置完成。{' '}
                {enhancedFeatures.length > 0
                  ? '该后端同时提供 Hermes 执行引擎（网关）增强功能。'
                  : '后续连接 Hermes 执行引擎（网关）时，增强功能将自动解锁。'}
              </p>
              <div
                className="grid grid-cols-3 gap-2 text-xs"
                style={mutedStyle}
              >
                <div className="rounded-xl p-2" style={cardStyle}>
                  <div className="mb-1 text-lg">
                    <EmojiIcon emoji="💬" size={18} />
                  </div>
                  <div>对话就绪</div>
                </div>
                <div className="rounded-xl p-2" style={cardStyle}>
                  <div className="mb-1 text-lg">
                    <EmojiIcon emoji="🔗" size={18} />
                  </div>
                  <div>
                    {enhancedFeatures.length > 0 ? '增强' : '便携'}
                  </div>
                </div>
                <div className="rounded-xl p-2" style={cardStyle}>
                  <div className="mb-1 text-lg">
                    <EmojiIcon emoji="🧠" size={18} />
                  </div>
                  <div>
                    {enhancedFeatures.length > 0
                      ? enhancedFeatures.length
                      : '可选'}{' '}
                    扩展
                  </div>
                </div>
              </div>
              {enhancedFeatures.length > 0 ? (
                <p className="text-xs" style={mutedStyle}>
                  当前可用：{enhancedFeatures.join('、')}。
                </p>
              ) : null}
              <button
                onClick={complete}
                className="w-full rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
              >
                进入工作区
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
