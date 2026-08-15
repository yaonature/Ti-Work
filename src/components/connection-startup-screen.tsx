import { useEffect, useRef, useState } from 'react'
import { EmojiIcon } from '@/components/emoji-icon'
import type { AuthStatus } from '@/lib/hermes-auth'
import { writeTextToClipboard } from '@/lib/clipboard'
import { fetchHermesAuthStatus } from '@/lib/hermes-auth'

const POLL_INTERVAL_MS = 2_000
const FAILURE_REVEAL_MS = 5_000

type Platform = 'macos' | 'windows' | 'linux' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('win')) return 'windows'
  if (ua.includes('mac')) return 'macos'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function getSetupSteps(
  platform: Platform,
): Array<{ title: string; command: string; note?: string }> {
  const pip = platform === 'windows' ? 'pip' : 'pip3'
  const python = platform === 'windows' ? 'python' : 'python3'

  return [
    {
      title: '使用任意 OpenAI 兼容后端',
      command: '设置 HERMES_API_URL 为你的后端地址',
      note: '便携对话支持任意提供 /v1/chat/completions 接口的后端（Ollama、LiteLLM、vLLM 等）',
    },
    {
      title: '可选：在本地运行 Hermes 执行引擎（网关）',
      command: 'git clone https://github.com/outsourc-e/hermes-agent.git',
      note: 'Hermes 执行引擎（网关）API 将自动解锁会话、技能、记忆等工作区增强功能',
    },
    {
      title: '安装网关',
      command: `cd hermes-agent && ${python} -m venv .venv && ${platform === 'windows' ? '.venv\\Scripts\\activate' : 'source .venv/bin/activate'} && ${pip} install -e .`,
    },
    {
      title: '启用 HTTP API 服务',
      command: 'echo "API_SERVER_ENABLED=true" >> ~/.hermes/.env',
      note: '网关 HTTP API 为可选开启。未开启时网关仅服务消息平台，不会为工作区开放 8642 端口。',
    },
    {
      title: '启动网关',
      command: `cd hermes-agent && ${platform === 'windows' ? '.venv\\Scripts\\activate' : 'source .venv/bin/activate'} && hermes --gateway`,
      note: '如果 hermes-agent 已安装在本地，可使用下方的自动启动',
    },
  ]
}

type Props = { onConnected: (status: AuthStatus) => void }

declare global {
  interface Window {
    __dismissSplash?: () => void
  }
}

export function ConnectionStartupScreen({ onConnected }: Props) {
  const [showFailureState, setShowFailureState] = useState(false)
  const [serverStarting, setServerStarting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverLog, setServerLog] = useState<Array<string>>([])
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [showManual, setShowManual] = useState(false)

  const platform = useRef<Platform>(detectPlatform())
  const steps = getSetupSteps(platform.current)

  const onConnectedRef = useRef(onConnected)
  useEffect(() => {
    onConnectedRef.current = onConnected
  }, [onConnected])

  const isDone = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const dismiss = window.__dismissSplash
    if (!dismiss) return
    const timer = setTimeout(() => dismiss(), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    isDone.current = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    const failureTimer = setTimeout(() => {
      if (!isDone.current) {
        setShowFailureState(true)
      }
    }, FAILURE_REVEAL_MS)

    const tryConnect = async () => {
      try {
        const status = await fetchHermesAuthStatus()
        if (isDone.current) return
        isDone.current = true
        clearTimeout(failureTimer)
        if (pollTimer) clearTimeout(pollTimer)
        onConnectedRef.current(status)
      } catch {
        if (isDone.current) return
        pollTimer = setTimeout(tryConnect, POLL_INTERVAL_MS)
      }
    }

    void tryConnect()

    return () => {
      isDone.current = true
      if (pollTimer) clearTimeout(pollTimer)
      clearTimeout(failureTimer)
    }
  }, [])

  useEffect(() => {
    if (copiedIdx === null) return
    const timer = setTimeout(() => setCopiedIdx(null), 2_000)
    return () => clearTimeout(timer)
  }, [copiedIdx])

  const handleCopy = async (text: string, idx: number) => {
    try {
      await writeTextToClipboard(text)
      setCopiedIdx(idx)
    } catch {
      /* clipboard not available */
    }
  }

  const handleAutoStart = async () => {
    setServerStarting(true)
    setServerError(null)
    setServerLog(['正在查找 hermes-agent...'])
    try {
      const res = await fetch('/api/start-hermes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        const msg = `意外响应（${res.status}）`
        setServerLog([`错误：${msg}`])
        setServerError(msg)
        setServerStarting(false)
        return
      }

      const data = (await res.json()) as Record<string, unknown>
      if (res.ok && data.ok) {
        setServerLog([
          String(data.message || '已启动 —— 等待连接...'),
        ])
        setServerStarting(false)
        return
      }

      const msg = String(data.error || '未找到 hermes-agent')
      const hint = data.hint ? String(data.hint) : ''
      setServerLog([`错误：${msg}`])
      if (hint) setServerLog((prev) => [...prev, `提示：${hint}`])
      setServerError(msg)
      setServerStarting(false)
      // 自动启动失败时展示手动步骤
      setShowManual(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setServerLog([`失败：${msg}`])
      setServerError(msg)
      setServerStarting(false)
      setShowManual(true)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-6 py-10 text-white"
      style={{
        backgroundColor: '#0A0E1A',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <img
          src="/ti-work-logo.svg"
          alt="Ti Work"
          className="mb-5 h-20 w-20 rounded-2xl object-cover shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        />

        <h1 className="text-[2rem] font-semibold tracking-tight text-white">
          Ti Work
        </h1>

        {/* Connecting spinner */}
        <div
          className={[
            'mt-4 flex items-center gap-3 text-sm text-white/72 transition-opacity duration-300',
            showFailureState ? 'opacity-0 h-0' : 'opacity-100',
          ].join(' ')}
          aria-hidden={showFailureState}
        >
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <span>正在连接你的后端...</span>
        </div>

        {/* Failure state — setup guide */}
        <div
          className={[
            'w-full overflow-hidden transition-all duration-500 ease-out',
            showFailureState
              ? 'mt-6 max-h-[60rem] translate-y-0 opacity-100'
              : 'max-h-0 translate-y-2 opacity-0',
          ].join(' ')}
        >
          <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <p className="text-base font-medium text-white">
              欢迎！连接你的后端
            </p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Ti Work 兼容任意 OpenAI 接口的后端。接入 Hermes
              网关后，增强功能将自动解锁。
            </p>

            {/* Auto-start section */}
            <div className="mt-5">
              <button
                type="button"
                disabled={serverStarting}
                onClick={handleAutoStart}
                className={[
                  'w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                  serverStarting
                    ? 'cursor-not-allowed bg-indigo-900/70 text-indigo-200'
                    : 'bg-indigo-500 text-white hover:bg-indigo-400',
                ].join(' ')}
              >
                {serverStarting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white/90" />
                    正在检测...
                  </span>
                ) : (
                  '自动启动 Hermes 执行引擎（网关）'
                )}
              </button>

              {/* Server log */}
              {serverLog.length > 0 ? (
                <div
                  className={[
                    'mt-3 rounded-xl border p-3',
                    serverError
                      ? 'border-red-500/20 bg-red-950/30'
                      : 'border-emerald-500/20 bg-emerald-950/30',
                  ].join(' ')}
                >
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-white/70">
                    {serverLog.join('\n')}
                  </pre>
                </div>
              ) : null}
            </div>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <button
                type="button"
                onClick={() => setShowManual(!showManual)}
                className="text-xs font-medium text-white/50 transition hover:text-white/70"
              >
                {showManual ? '收起' : '显示'}手动设置
              </button>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Manual setup steps */}
            <div
              className={[
                'overflow-hidden transition-all duration-300',
                showManual ? 'max-h-[40rem] opacity-100' : 'max-h-0 opacity-0',
              ].join(' ')}
            >
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-white/8 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-300">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-white/90">
                          {step.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(step.command, idx)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white/80"
                      >
                        {copiedIdx === idx ? (
                          <>
                            {' '}
                            <EmojiIcon emoji="✓" size={12} /> 已复制
                          </>
                        ) : (
                          '复制'
                        )}
                      </button>
                    </div>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 font-mono text-xs leading-5 text-white/80">
                      <code>{step.command}</code>
                    </pre>
                    {step.note ? (
                      <p className="mt-2 text-xs text-white/40">{step.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Env var hint */}
              <div className="mt-4 rounded-xl border border-white/6 bg-white/3 p-3">
                <p className="text-xs font-medium text-white/50">
                  将{' '}
                  <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/70">
                    HERMES_API_URL
                  </code>{' '}
                  指向任意 OpenAI 兼容后端：
                </p>
                <pre className="mt-2 overflow-x-auto font-mono text-xs text-white/60">
                  HERMES_API_URL=http://your-server:8642 pnpm dev
                </pre>
              </div>
            </div>
          </div>
        </div>

        {!showFailureState ? (
          <p className="mt-6 text-xs text-white/45">
            检测到兼容后端后，本页面将自动刷新
          </p>
        ) : null}
      </div>
    </div>
  )
}
