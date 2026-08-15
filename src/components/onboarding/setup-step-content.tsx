'use client'

import { Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  RefreshIcon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import type { OnboardingStepComponentProps } from './onboarding-steps'
import { ProviderSelectStep } from './provider-select-step'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AuthCheckResponse = {
  authenticated?: boolean
  authRequired?: boolean
  error?: string
}

type HermesConfigResponse = {
  activeProvider?: string
  activeModel?: string
  providers?: Array<{
    id: string
    authType?: string
    configured?: boolean
    authSource?: string
  }>
}

type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export function ConnectionCheckStep({
  setCanProceed,
}: OnboardingStepComponentProps) {
  const [status, setStatus] = useState<ConnectionStatus>('checking')
  const [lastError, setLastError] = useState<string | null>(null)

  const checkConnection = useCallback(async () => {
    setStatus('checking')
    setLastError(null)

    try {
      const response = await fetch('/api/auth-check', {
        signal: AbortSignal.timeout(5000),
      })
      const data = (await response.json()) as AuthCheckResponse
      const connected =
        response.ok &&
        data.error !== 'server_timeout' &&
        (data.authenticated === true || data.authRequired === false)

      setStatus(connected ? 'connected' : 'disconnected')
      if (!connected) {
        setLastError(
          data.error === 'server_timeout'
            ? 'Hermes Agent 响应超时。'
            : '暂时无法连接到 Hermes Agent。',
        )
      }
    } catch (error) {
      setStatus('disconnected')
      setLastError(
        error instanceof Error ? error.message : '连接检查失败。',
      )
    }
  }, [])

  useEffect(() => {
    void checkConnection()
  }, [checkConnection])

  useEffect(() => {
    setCanProceed(status === 'connected')
  }, [setCanProceed, status])

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div
        className={cn(
          'mb-5 flex size-20 items-center justify-center rounded-2xl',
          status === 'connected'
            ? 'bg-emerald-100 text-emerald-600'
            : status === 'disconnected'
              ? 'bg-red-100 text-red-600'
              : 'bg-primary-100 text-primary-500',
        )}
      >
        <HugeiconsIcon
          icon={
            status === 'connected'
              ? CheckmarkCircle02Icon
              : status === 'disconnected'
                ? Cancel01Icon
                : RefreshIcon
          }
          className={cn('size-10', status === 'checking' && 'animate-spin')}
          strokeWidth={1.8}
        />
      </div>

      <h2 className="mb-3 text-2xl font-semibold text-primary-900">
        连接检查
      </h2>

      <p className="mb-6 max-w-md text-base leading-relaxed text-primary-600">
        {status === 'connected'
          ? '后端已可访问，可以继续完成设置。'
          : status === 'checking'
            ? '正在检查是否存在可用的 OpenAI 兼容后端...'
            : '当前还没有检测到可用的兼容后端。'}
      </p>

      {status === 'disconnected' && (
        <div className="mb-6 w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left">
          <p className="mb-3 text-sm font-medium text-red-700">
            请先确认 Hermes HTTP API 服务已启用：
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-medium text-red-700 mb-1">
                1. 在 <code>~/.hermes/.env</code> 中启用 API 服务：
              </p>
              <code className="block overflow-x-auto rounded-lg bg-red-100 px-3 py-2 text-xs text-red-900">
                API_SERVER_ENABLED=true
              </code>
            </div>
            <div>
              <p className="text-xs font-medium text-red-700 mb-1">
                2. 重启网关：
              </p>
              <code className="block overflow-x-auto rounded-lg bg-red-100 px-3 py-2 text-xs text-red-900">
                cd hermes-agent && hermes --gateway
              </code>
            </div>
          </div>
          <p className="mt-3 text-xs text-red-700">
            或者将 <code>HERMES_API_URL</code> 指向任意 OpenAI 兼容后端
            （如 Ollama、LiteLLM、vLLM 等）。
          </p>
          {lastError && (
            <p className="mt-3 text-xs text-red-700">{lastError}</p>
          )}
        </div>
      )}

      <Button
        variant={status === 'connected' ? 'secondary' : 'default'}
        onClick={() => void checkConnection()}
        className="gap-2"
      >
        <HugeiconsIcon icon={RefreshIcon} className="size-4" />
        重新检查连接
      </Button>
    </div>
  )
}

export function ModelConfigurationStep({
  setCanProceed,
}: OnboardingStepComponentProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [config, setConfig] = useState<HermesConfigResponse | null>(null)
  const [hasKey, setHasKey] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setCanProceed(true)
  }, [setCanProceed])

  useEffect(() => {
    let cancelled = false

    async function loadConfig() {
      try {
        const response = await fetch('/api/hermes-config', {
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as HermesConfigResponse
        if (!cancelled) {
          setConfig(data)
          // 首启引导判定：任一 API Key 类提供方已真实配置（env / auth store / 网关模型）
          const providers = Array.isArray(data.providers) ? data.providers : []
          const anyKeyConfigured = providers.some(
            (p) =>
              p.authType === 'api_key' &&
              p.configured === true &&
              p.authSource !== 'none',
          )
          if (anyKeyConfigured) setHasKey(true)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
        }
      }
    }

    void loadConfig()

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  // 未配置任何 API Key → 内嵌首启引导，直接让用户配置第一个提供方
  if (status === 'ready' && !hasKey) {
    return (
      <div className="max-h-[60vh] w-full overflow-y-auto px-1 py-2 text-left">
        <ProviderSelectStep
          onComplete={() => {
            setHasKey(true)
            setReloadKey((k) => k + 1)
          }}
        />
      </div>
    )
  }

  const provider = config?.activeProvider?.trim()
  const model = config?.activeModel?.trim()
  const hasModel = Boolean(provider && model)

  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
        <HugeiconsIcon
          icon={Settings01Icon}
          className="size-10"
          strokeWidth={1.8}
        />
      </div>

      <h2 className="mb-3 text-2xl font-semibold text-primary-900">
        模型配置
      </h2>

      <p className="mb-6 max-w-md text-base leading-relaxed text-primary-600">
        核心会话能力可对接任意 OpenAI 兼容后端。通过 Hermes 网关 API，
        你可以直接在工作空间内调整提供方和模型设置。
      </p>

      <div className="mb-6 w-full rounded-2xl border border-primary-200 bg-primary-100/70 p-4 text-left">
        {status === 'loading' && (
          <p className="text-sm text-primary-600">
            正在加载当前提供方与模型信息...
          </p>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-3 text-amber-700">
            <HugeiconsIcon
              icon={Alert02Icon}
              className="mt-0.5 size-5 shrink-0"
            />
            <p className="text-sm">
              当前暂时无法读取可编辑的后端配置。如果聊天功能已可用，你仍可继续，
              并到后端自身的配置位置完成调整。
            </p>
          </div>
        )}

        {status === 'ready' && hasModel && (
          <p className="text-sm font-medium text-primary-900">
            当前模型：<span className="text-accent-700">{model}</span>，提供方：
            <span className="text-accent-700">{provider}</span>
          </p>
        )}

        {status === 'ready' && !hasModel && (
          <div className="flex items-start gap-3 text-amber-700">
            <HugeiconsIcon
              icon={Alert02Icon}
              className="mt-0.5 size-5 shrink-0"
            />
            <p className="text-sm">
              当前尚未检测到模型信息。如果你的后端在外部管理模型，请先在那里完成设置，
              再通过聊天测试确认连接是否正常。
            </p>
          </div>
        )}
      </div>

      <Link
        to="/settings/providers"
        className={buttonVariants({ variant: 'outline', className: 'gap-2' })}
      >
        <HugeiconsIcon icon={Settings01Icon} className="size-4" />
        打开提供方设置
      </Link>
    </div>
  )
}
