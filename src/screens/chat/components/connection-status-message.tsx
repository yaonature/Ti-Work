import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, WifiDisconnected01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type ConnectionStatusMessageProps = {
  state: 'checking' | 'error'
  error?: string | null
  status?: number | null
  onRetry?: () => void
  className?: string
}

function classifyConnectionError(
  error?: string | null,
  status?: number | null,
): {
  title: string
  description: string
  action: string
} {
  const normalizedError = error?.trim()
  const lower = normalizedError?.toLowerCase() ?? ''

  if (!normalizedError && !status) {
    return {
      title: '未连接',
      description: 'Ti Work 当前无法连接到 Hermes。',
      action: '请确认 Hermes 已启动，然后再试一次。',
    }
  }

  if (
    status === 401 ||
    lower.includes('auth') ||
    lower.includes('token') ||
    lower.includes('unauthorized')
  ) {
    return {
      title: '需要身份认证',
      description: 'Hermes 拒绝了当前连接令牌。',
      action: '请点击顶部横幅「一键连接」重试，或在设置中检查执行引擎配置。',
    }
  }

  if (
    status === 403 ||
    lower.includes('pair') ||
    lower.includes('not paired')
  ) {
    return {
      title: '需要先完成配对',
      description: '当前设备尚未与 Hermes 完成配对。',
      action: '请检查 Hermes Agent 连接状态。',
    }
  }

  if (lower.includes('econnrefused') && lower.includes('8642')) {
    return {
      title: 'Hermes WebAPI 未启动',
      description: '8642 端口上的 Hermes WebAPI 服务尚未运行。',
      action: '请执行：cd hermes-agent && pip install -e . && hermes-webapi',
    }
  }

  if (
    lower.includes('econnrefused') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('timed out') ||
    lower.includes('timeout')
  ) {
    return {
      title: '无法连接 Hermes',
      description: '无法访问当前配置的 Hermes 地址。',
      action: '请确认 Hermes 正在运行，且 URL 配置正确。',
    }
  }

  return {
    title: '连接异常',
    description: normalizedError || '出现了一点问题。',
    action: '请点击顶部横幅「一键连接」重试；如果网关已就绪，请在设置中检查模型配置。',
  }
}

export function ConnectionStatusMessage({
  state,
  error,
  status,
  onRetry,
  className,
}: ConnectionStatusMessageProps) {
  const isChecking = state === 'checking'
  const [visible, setVisible] = useState(true)
  const [fadingOut, setFadingOut] = useState(false)
  const errorInfo = classifyConnectionError(error, status)

  // Auto-dismiss when server comes back
  useEffect(() => {
    function handleRestored() {
      setFadingOut(true)
      setTimeout(() => setVisible(false), 300)
    }
    window.addEventListener('hermes:health-restored', handleRestored)
    return () =>
      window.removeEventListener('hermes:health-restored', handleRestored)
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'mx-auto max-w-lg rounded-lg border px-3 py-2 transition-all duration-300',
        isChecking
          ? 'border-primary-200 bg-primary-50 text-primary-600'
          : 'border-amber-200 bg-amber-50 text-amber-800',
        fadingOut && 'opacity-0 translate-y-[-4px]',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2">
        <HugeiconsIcon
          icon={isChecking ? WifiDisconnected01Icon : Alert02Icon}
          size={16}
          strokeWidth={1.5}
          className={cn(
            'mt-0.5 shrink-0',
            isChecking ? 'text-primary-500' : 'text-amber-600',
          )}
        />
        <div className="flex-1 text-xs">
          <p className="font-medium">
            {isChecking ? '正在连接 Hermes...' : errorInfo.title}
          </p>
          {!isChecking ? (
            <>
              <p className="mt-0.5 text-amber-700">{errorInfo.description}</p>
              <p className="mt-1 font-medium text-amber-800">
                {errorInfo.action}
              </p>
            </>
          ) : null}
        </div>
        {!isChecking && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 rounded-md border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200 dark:hover:bg-amber-900/30"
          >
            重试
          </button>
        )}
      </div>
    </div>
  )
}
