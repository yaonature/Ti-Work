'use client'

import { useState } from 'react'
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  RefreshIcon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmojiIcon } from '@/components/emoji-icon'

/* ── Provider Definitions ── */

type Provider = {
  id: string
  name: string
  description: string
  badge?: '推荐' | '热门'
  logo: React.ReactNode
  placeholder: string
  helpUrl: string
  helpLabel: string
}

function AnthropicLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.304 3.541h-3.48l6.36 16.918h3.48L17.304 3.541zM6.696 3.541.336 20.459h3.48l1.272-3.48h6.24l1.272 3.48h3.48L9.72 3.541H6.696zm-.36 10.458L8.88 7.326l2.544 6.673H6.336z" />
    </svg>
  )
}

function OpenRouterLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3h8l4 4v8l-4 4H8l-4-4V7l4-4z" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function OpenAILogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  )
}

const PROVIDERS: Array<Provider> = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description:
      '适合复杂推理、长文本写作和高精度指令场景',
    badge: '推荐',
    logo: <AnthropicLogo className="size-8" />,
    placeholder: 'sk-ant-...',
    helpUrl: 'https://console.anthropic.com/settings/keys',
    helpLabel: '获取 API Key →',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description:
      '通过一个 API 访问 200+ AI 模型，适合灵活试验和多模型切换',
    badge: '热门',
    logo: <OpenRouterLogo className="size-8" />,
    placeholder: 'sk-or-v1-...',
    helpUrl: 'https://openrouter.ai/keys',
    helpLabel: '获取 API Key →',
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    description: '擅长图像、文档和超长上下文处理',
    logo: <GoogleLogo className="size-8" />,
    placeholder: 'AI...',
    helpUrl: 'https://aistudio.google.com/apikey',
    helpLabel: '获取 API Key →',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    description: '适合会话、编码与日常工作任务的全能型选择',
    logo: <OpenAILogo className="size-8" />,
    placeholder: 'sk-...',
    helpUrl: 'https://platform.openai.com/api-keys',
    helpLabel: '获取 API Key →',
  },
]

/* ── Component ── */

type ProviderSelectStepProps = {
  onComplete: (providerId: string, apiKey: string) => void
  onSkip?: () => void
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'warning'

/**
 * 轮询 GET /api/models，确认给定 provider 已出现在 configuredProviders 中。
 * 返回 true 表示网关已加载该 provider；false 表示超时（网关未重载/模型未就绪）。
 */
async function pollForProvider(
  providerId: string,
  timeoutMs = 12_000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  const interval = 1_500

  while (Date.now() < deadline) {
    try {
      const res = await fetch('/api/models')
      if (res.ok) {
        const data = (await res.json()) as {
          configuredProviders?: Array<string>
        }
        const configured = Array.isArray(data.configuredProviders)
          ? data.configuredProviders
          : []
        if (
          configured.some((p) => p.toLowerCase() === providerId.toLowerCase())
        ) {
          return true
        }
      }
    } catch {
      // network blip — keep polling
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await new Promise((r) =>
      globalThis.setTimeout(r, Math.min(interval, remaining)),
    )
  }

  return false
}

export function ProviderSelectStep({
  onComplete,
  onSkip,
}: ProviderSelectStepProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const selected = PROVIDERS.find((p) => p.id === selectedId)

  const handleSaveAndVerify = async () => {
    if (!selectedId || !apiKey.trim()) return
    setSaveStatus('saving')
    setError(null)

    const raw = JSON.stringify(
      {
        auth: {
          profiles: {
            [`${selectedId}:default`]: {
              provider: selectedId,
              apiKey: apiKey.trim(),
            },
          },
        },
      },
      null,
      2,
    )

    try {
      const res = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw,
          reason: 'Ti Work 首启：添加 API 密钥',
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!data.ok) {
        setSaveStatus('error')
        setError(data.error || '保存失败，请稍后重试')
        return
      }

      // 网关热重载后确认该 provider 的模型是否可用
      const found = await pollForProvider(selectedId)
      if (found) {
        setSaveStatus('saved')
      } else {
        setSaveStatus('warning')
        setError(
          'API Key 已保存，但网关可能尚未加载其模型。可在设置页检查，或重启应用后生效。',
        )
      }
    } catch {
      setSaveStatus('error')
      setError('保存失败，请检查当前连接后重试')
    }
  }

  const handleContinue = () => {
    if (selectedId && apiKey.trim()) {
      onComplete(selectedId, apiKey.trim())
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setApiKey(text)
        setSaveStatus('idle')
        setError(null)
      }
    } catch {
      // Clipboard access denied
    }
  }

  const isBusy = saveStatus === 'saving'
  const isSaved = saveStatus === 'saved'

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-semibold text-primary-900">
          配置你的 AI 提供方
        </h2>
        <p className="text-sm text-primary-600">
          选择提供方并粘贴 API Key，保存后即可开始使用。后续可在设置中随时切换或添加。
        </p>
      </div>

      {/* Provider Cards Grid */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const isSelected = selectedId === provider.id
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => {
                setSelectedId(provider.id)
                setApiKey('')
                setSaveStatus('idle')
                setError(null)
              }}
              className={cn(
                'group relative flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-150',
                isSelected
                  ? 'border-accent-500 bg-accent-50/50 ring-1 ring-accent-500/30'
                  : 'border-primary-200 bg-primary-50 hover:border-primary-300 hover:bg-primary-100/50',
              )}
            >
              {/* Radio indicator */}
              <div
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  isSelected
                    ? 'border-accent-500 bg-accent-500'
                    : 'border-primary-300',
                )}
              >
                {isSelected && <div className="size-2 rounded-full bg-white" />}
              </div>

              {/* Logo */}
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-100/80 text-primary-700">
                {provider.logo}
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary-900">
                    {provider.name}
                  </span>
                  {provider.badge && (
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        provider.badge === '推荐'
                          ? 'bg-accent-100 text-accent-700'
                          : 'bg-purple-100 text-purple-700',
                      )}
                    >
                      {provider.badge}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
                  {provider.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* API Key Input (shown when provider selected) */}
      {selected && (
        <div className="mb-5 rounded-xl border border-primary-200 bg-primary-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-sm font-medium text-primary-900">
              {selected.name} API Key
            </label>
            <a
              href={selected.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              {selected.helpLabel}
            </a>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={selected.placeholder}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setSaveStatus('idle')
                  setError(null)
                }}
                className="h-10 pr-20 font-mono text-xs"
              />
              <div className="absolute right-1 top-1 flex gap-0.5">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-primary-400 hover:text-primary-600"
                  title={showKey ? '隐藏' : '显示'}
                >
                  <HugeiconsIcon
                    icon={showKey ? ViewOffIcon : ViewIcon}
                    size={16}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  onClick={handlePaste}
                  className="inline-flex size-8 items-center justify-center rounded-md text-primary-400 hover:text-primary-600"
                  title="从剪贴板粘贴"
                >
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    size={16}
                    strokeWidth={1.5}
                  />
                </button>
              </div>
            </div>
            <Button
              variant="secondary"
              size="default"
              onClick={() => void handleSaveAndVerify()}
              disabled={!apiKey.trim() || isBusy}
              className="shrink-0"
            >
              {isBusy ? (
                <>
                  <HugeiconsIcon icon={RefreshIcon} className="size-4 animate-spin" />
                  保存中
                </>
              ) : (
                '保存并验证'
              )}
            </Button>
          </div>

          {/* Feedback */}
          {isSaved && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-green-700">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                strokeWidth={2}
              />
              <span>API Key 已保存，模型可用。</span>
            </div>
          )}
          {saveStatus === 'warning' && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600">
              <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
              <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onSkip && (
          <Button
            variant="secondary"
            onClick={onSkip}
            disabled={isBusy}
            className="flex-1"
          >
            暂时跳过
          </Button>
        )}
        <Button
          variant="default"
          onClick={handleContinue}
          disabled={!selectedId || !apiKey.trim() || isBusy || !isSaved}
          className={cn(
            'flex-1 bg-accent-500 hover:bg-accent-600',
            isSaved && 'bg-green-600 hover:bg-green-700',
          )}
        >
          {isSaved ? (
            <>
              继续 <EmojiIcon emoji="✓" size={14} />
            </>
          ) : (
            '继续'
          )}
        </Button>
      </div>
    </div>
  )
}
