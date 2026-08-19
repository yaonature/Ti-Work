import { useEffect, useRef, useState } from 'react'

const POLL_INTERVAL_MS = 10_000
const FLASH_DURATION_MS = 1_800

type HermesReconnectBannerProps = {
  enabled?: boolean
}

type BannerState = 'hidden' | 'disconnected' | 'connected'

async function probeHermesHealth(): Promise<boolean> {
  // Use the portable-aware connection status endpoint first,
  // which works with both full Hermes and OpenAI-compatible backends.
  try {
    const response = await fetch('/api/connection-status', {
      cache: 'no-store',
    })
    const payload = response.ok
      ? ((await response.json()) as {
          status?: string
          health?: boolean
          chatReady?: boolean
          chatMode?: string
        })
      : null
    if (response.ok) {
      return payload?.status !== 'disconnected'
    }
  } catch {
    /* fall through */
  }
  // Fallback to direct health proxy
  try {
    const response = await fetch('/api/hermes-proxy/health', {
      cache: 'no-store',
    })
    return response.ok
  } catch {
    return false
  }
}

type BootstrapProgress = {
  ok?: boolean
  phase?: 'idle' | 'detecting' | 'installing' | 'configuring' | 'starting' | 'ready' | 'failed'
  message?: string
  error?: string | null
  failureCategory?: 'install-failed' | 'gateway-not-ready' | 'config-needed' | 'config-invalid' | null
  preparedBy?: 'installer' | 'first-launch' | null
  stageIndex?: number
  stageCount?: number
  currentStage?: string | null
}

function describeBootstrapFailure(progress: BootstrapProgress): string {
  if (progress.failureCategory === 'gateway-not-ready') {
    return '执行引擎已安装，但网关未就绪。请稍后点击「重试」。'
  }
  if (progress.failureCategory === 'install-failed') {
    return `执行引擎安装失败。${progress.error ?? '请点击「重试」。'}`
  }
  return progress.error || '执行引擎安装失败'
}

async function fetchBootstrapProgress(): Promise<BootstrapProgress | null> {
  try {
    const response = await fetch('/api/engine-bootstrap', {
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as BootstrapProgress
  } catch {
    return null
  }
}

export function HermesReconnectBanner({
  enabled = true,
}: HermesReconnectBannerProps) {
  const [bannerState, setBannerState] = useState<BannerState>('hidden')
  const [isChecking, setIsChecking] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  const mountedRef = useRef(true)
  const inFlightProbeRef = useRef<Promise<boolean> | null>(null)
  const probeNowRef = useRef<
    ((showSpinner: boolean) => Promise<boolean>) | null
  >(null)
  const wasDisconnectedRef = useRef(false)
  const dismissedRef = useRef(false)
  const flashTimerRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setBannerState('hidden')
      setIsChecking(false)
      setIsStarting(false)
      setMessage(null)
      setIsBootstrapping(false)
      wasDisconnectedRef.current = false
      dismissedRef.current = false
      if (flashTimerRef.current !== null) {
        window.clearTimeout(flashTimerRef.current)
        flashTimerRef.current = null
      }
      return
    }

    let cancelled = false

    const runProbe = async (showSpinner: boolean): Promise<boolean> => {
      if (inFlightProbeRef.current) {
        return inFlightProbeRef.current
      }

      if (showSpinner && mountedRef.current) {
        setIsChecking(true)
      }

      const pendingProbe = probeHermesHealth()
        .then(async (connected) => {
          if (cancelled || !mountedRef.current) return connected

          if (flashTimerRef.current !== null) {
            window.clearTimeout(flashTimerRef.current)
            flashTimerRef.current = null
          }

          if (connected) {
            setMessage(null)
            setIsBootstrapping(false)
            if (wasDisconnectedRef.current) {
              window.dispatchEvent(new CustomEvent('hermes:health-restored'))
              setBannerState('connected')
              wasDisconnectedRef.current = false
              flashTimerRef.current = window.setTimeout(() => {
                if (!mountedRef.current) return
                setBannerState('hidden')
                flashTimerRef.current = null
              }, FLASH_DURATION_MS)
            } else {
              setBannerState('hidden')
            }
          } else {
            wasDisconnectedRef.current = true
            if (!dismissedRef.current) {
              setBannerState('disconnected')
            }
            const progress = await fetchBootstrapProgress()
            if (
              progress?.phase === 'detecting' ||
              progress?.phase === 'installing' ||
              progress?.phase === 'configuring' ||
              progress?.phase === 'starting'
            ) {
              setIsBootstrapping(true)
              const total = progress.stageCount ?? 0
              const index =
                total > 0
                  ? Math.min((progress.stageIndex ?? -1) + 1, total)
                  : 0
              setMessage(
                progress.preparedBy === 'installer'
                  ? '执行引擎已就绪（安装期预装），正在启动网关…'
                  : progress.currentStage
                    ? `正在安装执行引擎（${index}/${total}）：${progress.currentStage}`
                    : progress.message || '正在准备执行引擎…',
              )
            } else if (progress?.phase === 'failed') {
              setIsBootstrapping(false)
              setMessage(describeBootstrapFailure(progress))
            } else if (!dismissedRef.current) {
              setIsBootstrapping(false)
              setMessage(null)
            }
          }

          return connected
        })
        .catch((error) => {
          if (!cancelled && mountedRef.current) {
            wasDisconnectedRef.current = true
            if (!dismissedRef.current) {
              setBannerState('disconnected')
            }
            setIsBootstrapping(false)
            setMessage(
              error instanceof Error ? error.message : '连接失败',
            )
          }
          return false
        })
        .finally(() => {
          inFlightProbeRef.current = null
          if (!cancelled && mountedRef.current) {
            setIsChecking(false)
          }
        })

      inFlightProbeRef.current = pendingProbe
      return pendingProbe
    }

    probeNowRef.current = runProbe
    void runProbe(false)
    const interval = window.setInterval(() => {
      void runProbe(false)
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      probeNowRef.current = null
      window.clearInterval(interval)
    }
  }, [enabled])

  async function handleRetry(): Promise<void> {
    if (!enabled) return
    setMessage(null)
    await probeNowRef.current?.(true)
  }

  async function handleStartAgent(): Promise<void> {
    if (!enabled) return
    setIsStarting(true)
    setMessage(null)
    setIsBootstrapping(true)

    try {
      const response = await fetch('/api/start-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Hermes 智能体启动失败')
      }

      setMessage(
        payload.message === 'already running'
          ? '执行引擎已在运行'
          : '正在准备执行引擎…',
      )

      // 自动安装进行中 → 轮询进度（首次安装需要几分钟）
      if (payload.message !== 'already running') {
        for (let i = 0; i < 300; i += 1) {
          if (!mountedRef.current) return
          await new Promise((resolveWait) => setTimeout(resolveWait, 2_000))
          const progress = await fetchBootstrapProgress()
          if (!progress) continue
          if (progress.phase === 'ready') break
          if (progress.phase === 'failed') {
            throw new Error(describeBootstrapFailure(progress))
          }
          if (
            progress.phase === 'installing' ||
            progress.phase === 'configuring' ||
            progress.phase === 'starting'
          ) {
            const total = progress.stageCount ?? 0
            const index = Math.min(progress.stageIndex ?? 0, total)
            setMessage(
              progress.preparedBy === 'installer'
                ? '执行引擎已就绪（安装期预装），正在启动网关…'
                : progress.currentStage
                  ? `正在安装执行引擎（${index}/${total}）：${progress.currentStage}`
                  : progress.message || '正在安装执行引擎…',
            )
          }
        }
      }
    } catch (error) {
      setIsBootstrapping(false)
      setMessage(
        error instanceof Error ? error.message : '执行引擎启动失败',
      )
    } finally {
      setIsStarting(false)
      await probeNowRef.current?.(true)
    }
  }

  if (!enabled || bannerState === 'hidden') {
    return null
  }

  const isDisconnected = bannerState === 'disconnected'
  const title =
    isDisconnected && isBootstrapping ? '执行引擎启动中' : isDisconnected ? '执行引擎未连接' : '已连接'

  return (
    <div
      className="fixed inset-x-0 z-50 px-4 pt-3"
      style={{ top: 'var(--titlebar-h, 0px)' }}
    >
      <div
        className="mx-auto flex min-h-12 w-full max-w-5xl items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-lg"
        style={{
          background: 'var(--theme-card)',
          borderColor: isDisconnected
            ? 'var(--theme-danger)'
            : 'var(--theme-border)',
          color: isDisconnected ? 'var(--theme-danger)' : 'inherit',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: isDisconnected
                ? 'var(--theme-danger)'
                : 'var(--theme-border)',
            }}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {title}
            </p>
            {isDisconnected && !message ? (
              <p className="text-xs opacity-70">
                Ti Work 需要连接执行引擎（Hermes 网关）才能对话与使用增强功能。启动后端后点击「重试」。
              </p>
            ) : message ? (
              <p className="truncate text-xs opacity-80">{message}</p>
            ) : null}
          </div>
        </div>

        {isDisconnected ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={isChecking || isStarting}
              className="rounded-md border px-3 py-1.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: 'var(--theme-border)',
                background: 'var(--theme-card)',
                color: 'inherit',
              }}
            >
              {isChecking ? '正在重试…' : '重试'}
            </button>
            <button
              type="button"
              onClick={() => void handleStartAgent()}
              disabled={isStarting}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: 'var(--theme-danger)',
              }}
            >
              {isStarting ? '正在启动…' : '一键连接'}
            </button>
            <button
              type="button"
              onClick={() => {
                dismissedRef.current = true
                setBannerState('hidden')
              }}
              className="rounded-md px-2.5 py-1.5 text-sm opacity-70 transition-opacity hover:opacity-100"
              style={{ color: 'inherit' }}
              aria-label="稍后再说"
            >
              稍后再说
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
