import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Copy01Icon,
  Link01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useRef, useState } from 'react'
import { ProviderIcon } from './provider-icon'
import type { ProviderAuthType } from '@/lib/provider-catalog'
import {
  HERMES_CONFIG_PATH,
  PROVIDER_CATALOG,
  buildConfigExample,
  getAuthTypeLabel,
  getProviderInfo,
} from '@/lib/provider-catalog'
import { writeTextToClipboard } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { useConnectionRestart } from '@/components/connection-overlay'
import { cn } from '@/lib/utils'
import { EmojiIcon } from '@/components/emoji-icon'

type WizardStep = 'provider' | 'auth' | 'instructions' | 'verify'
type CopyState = 'idle' | 'copied' | 'failed'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type VerifyState = 'checking' | 'success' | 'warning'

type ProviderWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-fill with an existing provider for editing */
  editProvider?: ProviderSummaryForEdit | null
}

export type ProviderSummaryForEdit = {
  id: string
  name: string
}

type StepItem = {
  id: WizardStep
  label: string
}

type AuthTypeMeta = {
  title: string
  description: string
}

const WIZARD_STEPS: Array<StepItem> = [
  { id: 'provider', label: '选择服务提供方' },
  { id: 'auth', label: '选择认证方式' },
  { id: 'instructions', label: '配置' },
  { id: 'verify', label: '验证连接' },
]

const AUTH_TYPE_ORDER: Array<ProviderAuthType> = [
  'api-key',
  'cli-token',
  'oauth',
  'local',
]

function getAuthTypeMeta(authType: ProviderAuthType): AuthTypeMeta {
  if (authType === 'api-key') {
    return {
      title: 'API 密钥',
      description: '粘贴您的 API 密钥 — 它将直接保存到本地配置',
    }
  }

  if (authType === 'cli-token') {
    return {
      title: 'CLI Token',
      description:
        '复用您现有的 Claude CLI 认证令牌（来自 Claude Code / claude.ai）',
    }
  }

  if (authType === 'oauth') {
    return {
      title: 'OAuth',
      description: '通过浏览器登录 — OAuth 流程将自动开始',
    }
  }

  return {
    title: '本地',
    description: '无需认证（Ollama）',
  }
}

function getStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.findIndex(function findStep(item) {
    return item.id === step
  })
}

/**
 * Poll GET /api/models for up to `timeoutMs` (default 10 s).
 * Resolves true if the given providerId appears in the response, false on timeout.
 */
async function pollForProvider(
  providerId: string,
  timeoutMs = 10_000,
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

export function ProviderWizard({
  open,
  onOpenChange,
  editProvider,
}: ProviderWizardProps) {
  const { triggerRestart } = useConnectionRestart()

  const [step, setStep] = useState<WizardStep>('provider')
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    null,
  )
  const [selectedAuthType, setSelectedAuthType] =
    useState<ProviderAuthType | null>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState('')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showManualSnippet, setShowManualSnippet] = useState(false)
  const [verificationMessage, setVerificationMessage] = useState('')
  const [verifyState, setVerifyState] = useState<VerifyState>('checking')
  const pollingRef = useRef(false)

  const currentStepIndex = getStepIndex(step)
  const selectedProvider = selectedProviderId
    ? getProviderInfo(selectedProviderId)
    : null
  const configExample =
    selectedProvider && selectedAuthType
      ? buildConfigExample(selectedProvider, selectedAuthType)
      : ''

  // When opened with editProvider, jump straight to auth step
  useEffect(() => {
    if (open && editProvider) {
      setSelectedProviderId(editProvider.id)
      setSelectedAuthType(null)
      setStep('auth')
    }
  }, [open, editProvider])

  function resetState() {
    setStep('provider')
    setSelectedProviderId(null)
    setSelectedAuthType(null)
    setCopyState('idle')
    setSaveState('idle')
    setSaveError('')
    setApiKeyInput('')
    setShowManualSnippet(false)
    setVerificationMessage('')
    setVerifyState('checking')
    pollingRef.current = false
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      resetState()
    }
  }

  function handleSelectProvider(providerId: string) {
    setSelectedProviderId(providerId)
    setSelectedAuthType(null)
    setCopyState('idle')
    setVerificationMessage('')
    setVerifyState('checking')
    setStep('auth')
  }

  function handleChooseAuthType(authType: ProviderAuthType) {
    setSelectedAuthType(authType)
    setCopyState('idle')
    setVerificationMessage('')
    setVerifyState('checking')
    setStep('instructions')
  }

  async function handleCopyConfig() {
    if (!configExample) return

    try {
      await writeTextToClipboard(configExample)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  async function handleSaveApiKey() {
    if (!selectedProvider || !apiKeyInput.trim()) return

    setSaveState('saving')
    setSaveError('')

    const profileKey = `${selectedProvider.id}:default`
    const patch = {
      auth: {
        profiles: {
          [profileKey]: {
            provider: selectedProvider.id,
            apiKey: apiKeyInput.trim(),
          },
        },
      },
    }

    const providerName = selectedProvider.name
    const providerId = selectedProvider.id
    const patchBody = JSON.stringify({
      raw: JSON.stringify(patch, null, 2),
      reason: `Studio：添加 ${providerName} API 密钥`,
    })

    async function saveConfigAndRestart() {
      const res = await fetch('/api/config-patch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: patchBody,
      })

      const data = (await res.json()) as { ok: boolean; error?: string }

      if (!data.ok) {
        throw new Error(data.error || '保存配置失败')
      }
    }

    try {
      // Move to verify step, then trigger the restart flow
      setSaveState('saved')
      setVerifyState('checking')
      setVerificationMessage(
        `${providerName} API 密钥已保存；Hermes 正在重启…`,
      )
      setStep('verify')

      // Shows confirm dialog: user can click "Restart & Apply" or "Cancel"
      await triggerRestart(saveConfigAndRestart)

      // After restart, poll /api/models to confirm provider is visible
      if (!pollingRef.current) {
        pollingRef.current = true
        setVerificationMessage(
          `正在检查 ${providerName} 的模型是否可用…`,
        )

        const found = await pollForProvider(providerId)

        if (found) {
          setVerifyState('success')
          setVerificationMessage(
            `${providerName} 已连接，其模型可用。`,
          )
        } else {
          setVerifyState('warning')
          setVerificationMessage(
            `Hermes 已重启，但 ${providerName} 的模型尚未显示。` +
              ` 请检查您的 API 密钥，或稍后再刷新。`,
          )
        }
        pollingRef.current = false
      }
    } catch (err) {
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : '网络错误')
    }
  }

  function handleDone() {
    onOpenChange(false)
    resetState()
  }

  const verifyIconColor =
    verifyState === 'success'
      ? 'text-green-600'
      : verifyState === 'warning'
        ? 'text-amber-600'
        : 'text-primary-600'

  const verifyBorderColor =
    verifyState === 'success'
      ? 'border-green-200 bg-green-50/60'
      : verifyState === 'warning'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-[var(--theme-border)] bg-[var(--theme-panel)]/70'

  const verifyTitle =
    verifyState === 'success'
      ? '连接已验证'
      : verifyState === 'warning'
        ? '已连接（模型待确认）'
        : '正在检查连接…'

  return (
    <DialogRoot open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="left-auto right-0 top-[var(--titlebar-h,0px)] h-[calc(100dvh-var(--titlebar-h,0px))] w-screen translate-x-0 translate-y-0 overflow-hidden rounded-none border-[var(--theme-border)] bg-[var(--theme-bg)]/95 backdrop-blur-sm duration-300 ease-out sm:w-[min(860px,100vw)] sm:rounded-l-2xl data-[state=open]:scale-100 data-[state=closed]:scale-100 data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[var(--theme-border)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <DialogTitle className="text-balance">
                  {editProvider
                    ? `编辑服务提供方：${editProvider.name}`
                    : '服务提供方设置向导'}
                </DialogTitle>
                <DialogDescription className="text-pretty">
                  安全地添加服务提供方凭据。API 密钥仅存储在本地 Hermes 配置文件中，绝不会发送到 Studio。
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={function onClose() {
                  handleDialogOpenChange(false)
                }}
                aria-label="关闭服务提供方设置向导"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={20}
                  strokeWidth={1.5}
                />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {WIZARD_STEPS.map(function mapStep(item, index) {
                const isComplete = index < currentStepIndex
                const isCurrent = index === currentStepIndex

                return (
                  <li
                    key={item.id}
                    className={cn(
                      'rounded-xl border px-2.5 py-2',
                      isCurrent && 'border-primary-400 bg-[var(--theme-panel)]/70',
                      isComplete && 'border-green-500/30 bg-green-500/10',
                      !isCurrent &&
                        !isComplete &&
                        'border-[var(--theme-border)] bg-[var(--theme-bg)]',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex size-5 items-center justify-center rounded-full border text-xs font-medium tabular-nums',
                          isCurrent && 'border-primary-500 text-primary-800',
                          isComplete && 'border-green-500/40 text-green-600',
                          !isCurrent &&
                            !isComplete &&
                            'border-[var(--theme-border)] text-primary-600',
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate text-xs font-medium text-primary-800">
                        {item.label}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ol>

            {step === 'provider' ? (
              <section className="mt-5">
                <h3 className="text-base font-medium text-[var(--theme-text)] text-balance">
                  第 1 步：选择服务提供方
                </h3>
                <p className="mt-1 text-sm text-primary-600 text-pretty">
                  选择要配置的服务提供方。
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {PROVIDER_CATALOG.map(function mapProvider(provider) {
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={function onSelectProvider() {
                          handleSelectProvider(provider.id)
                        }}
                        className="rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg)]/70 p-3 text-left transition-colors hover:border-primary-400 hover:bg-[var(--theme-panel)] dark:hover:bg-primary-800/70"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70">
                            <ProviderIcon providerId={provider.id} />
                          </span>
                          <h4 className="text-sm font-medium text-[var(--theme-text)] text-balance">
                            {provider.name}
                          </h4>
                        </div>

                        <p className="mt-2 text-xs text-primary-600 text-pretty line-clamp-2">
                          {provider.description}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {provider.authTypes.map(function mapAuth(authType) {
                            return (
                              <span
                                key={authType}
                                className="rounded-full border border-[var(--theme-border)] bg-[var(--theme-panel)] px-2 py-0.5 text-xs text-[var(--theme-text)]"
                              >
                                {getAuthTypeLabel(authType)}
                              </span>
                            )
                          })}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ) : null}

            {step === 'auth' && selectedProvider ? (
              <section className="mt-5">
                <h3 className="text-base font-medium text-[var(--theme-text)] text-balance">
                  第 2 步：选择认证方式
                </h3>
                <p className="mt-1 text-sm text-primary-600 text-pretty">
                  {selectedProvider.name} 支持{' '}
                  {selectedProvider.authTypes
                    .map(function mapAuthType(authType) {
                      return getAuthTypeLabel(authType)
                    })
                    .join(', ')}
                  。
                </p>

                <div className="mt-3 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                  <p className="text-xs text-[var(--theme-text)] text-pretty">
                    配置文件路径：{' '}
                    <code className="font-mono">{HERMES_CONFIG_PATH}</code>
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {AUTH_TYPE_ORDER.map(function mapAuthType(authType) {
                    const meta = getAuthTypeMeta(authType)
                    const supported =
                      selectedProvider.authTypes.includes(authType)

                    return (
                      <button
                        key={authType}
                        type="button"
                        disabled={!supported}
                        onClick={function onChooseAuthType() {
                          handleChooseAuthType(authType)
                        }}
                        className={cn(
                          'rounded-2xl border p-3 text-left transition-colors',
                          supported
                            ? 'border-[var(--theme-border)] bg-[var(--theme-bg)]/70 hover:border-primary-400 hover:bg-[var(--theme-panel)] dark:hover:bg-primary-800/80'
                            : 'cursor-not-allowed border-[var(--theme-border)] bg-[var(--theme-bg)]/40 opacity-50',
                        )}
                      >
                        <h4 className="text-sm font-medium text-[var(--theme-text)] text-balance">
                          {meta.title}
                        </h4>
                        <p className="mt-1 text-xs text-primary-600 text-pretty">
                          {meta.description}
                        </p>
                        {!supported ? (
                          <p className="mt-2 text-xs text-[var(--theme-muted)] text-pretty">
                            {selectedProvider.name} 尚不支持此认证方式。
                          </p>
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={function onBack() {
                      // If editing, close wizard instead of going back to provider picker
                      if (editProvider) {
                        handleDialogOpenChange(false)
                      } else {
                        setStep('provider')
                      }
                    }}
                  >
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      size={20}
                      strokeWidth={1.5}
                    />
                    返回
                  </Button>
                </div>
              </section>
            ) : null}

            {step === 'instructions' && selectedProvider && selectedAuthType ? (
              <section className="mt-5">
                <h3 className="text-base font-medium text-[var(--theme-text)] text-balance">
                  第 3 步：添加您的 API 密钥
                </h3>

                {selectedAuthType === 'oauth' ? (
                  <>
                    <p className="mt-1 text-sm text-primary-600 text-pretty">
                      这将在您的终端中运行{' '}
                      <code className="font-mono text-primary-800">
                        hermes setup
                      </code>{' '}
                      以启动 OAuth 流程。随后浏览器窗口将打开，引导您使用 Google 完成登录。
                    </p>

                    <div className="mt-4 flex flex-col gap-3">
                      <Button
                        size="sm"
                        onClick={function onLaunchOAuth() {
                          window.open('/terminal', '_blank')
                          setVerificationMessage(
                            '在终端中运行 "hermes setup"，出现提示时选择 Google OAuth。' +
                              ' 浏览器将打开用于登录，完成后 Hermes 会自动重启。',
                          )
                          setVerifyState('warning')
                          setStep('verify')
                        }}
                      >
                        打开终端
                      </Button>

                      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                        <p className="text-xs text-[var(--theme-text)] text-pretty">
                          在终端中运行：
                        </p>
                        <pre className="mt-1 rounded-lg bg-primary-200/60 px-2 py-1.5 text-xs font-mono text-[var(--theme-text)]">
                          hermes setup
                        </pre>
                        <p className="mt-1.5 text-xs text-primary-600 text-pretty">
                          选择 <strong>Google Antigravity</strong> →{' '}
                          <strong>OAuth</strong>。将打开一个浏览器标签页进行 Google 登录。
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                        <p className="text-xs text-[var(--theme-text)] text-pretty">
                          无法使用终端？{' '}
                          <a
                            href="https://github.com/NousResearch/hermes-agent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-800 underline decoration-primary-400 hover:text-[var(--theme-text)]"
                          >
                            查看 Hermes Agent 文档
                          </a>{' '}
                          获取配置说明。
                        </p>
                      </div>
                    </div>
                  </>
                ) : selectedAuthType === 'cli-token' ? (
                  <>
                    <p className="mt-1 text-sm text-primary-600 text-pretty">
                      如果您已经安装了 Claude Code 或 Claude CLI，Hermes 可以复用相同的认证令牌。运行设置命令后，系统会自动检测并导入该令牌。
                    </p>

                    <div className="mt-4 flex flex-col gap-3">
                      <Button
                        size="sm"
                        onClick={function onLaunchCLI() {
                          window.open('/terminal', '_blank')
                          setVerificationMessage(
                            '在终端中运行 "hermes setup"，然后选择 Anthropic → CLI Token。' +
                              ' 您的 Claude CLI 凭据将被自动检测并导入。',
                          )
                          setVerifyState('warning')
                          setStep('verify')
                        }}
                      >
                        打开终端
                      </Button>

                      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                        <p className="text-xs text-[var(--theme-text)] text-pretty">
                          在终端中运行：
                        </p>
                        <pre className="mt-1 rounded-lg bg-primary-200/60 px-2 py-1.5 text-xs font-mono text-[var(--theme-text)]">
                          hermes setup
                        </pre>
                        <p className="mt-1.5 text-xs text-primary-600 text-pretty">
                          选择 <strong>Anthropic</strong> →{' '}
                          <strong>Setup Token (Claude CLI)</strong>。系统将自动从{' '}
                          <code className="font-mono">~/.claude/</code>{' '}
                          检测您现有的 Claude 凭据。
                        </p>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
                        <p className="text-xs text-amber-800 text-pretty">
                          <strong>前提条件：</strong>您需要先安装并登录 Claude Code 或 Claude CLI。请在终端中运行{' '}
                          <code className="font-mono">claude</code>{' '}
                          以确认。
                        </p>
                      </div>

                      <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                        <p className="text-xs text-[var(--theme-text)] text-pretty">
                          无法使用终端？{' '}
                          <a
                            href="https://github.com/NousResearch/hermes-agent"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary-800 underline decoration-primary-400 hover:text-[var(--theme-text)]"
                          >
                            查看 Hermes Agent 文档
                          </a>{' '}
                          获取 CLI Token 配置说明。
                        </p>
                      </div>
                    </div>
                  </>
                ) : selectedAuthType === 'api-key' ? (
                  <>
                    <p className="mt-1 text-sm text-primary-600 text-pretty">
                      在下方粘贴您的 {selectedProvider.name} API 密钥。它将直接保存到本地配置文件中。
                    </p>

                    <div className="mt-4 flex flex-col gap-3">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={function onInputChange(e) {
                            setApiKeyInput(e.target.value)
                          }}
                          placeholder={`sk-... 或您的 ${selectedProvider.name} API 密钥`}
                          className="flex-1 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder:text-primary-400 focus:border-accent-400 focus:outline-none focus:ring-1 focus:ring-accent-400/50"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          disabled={
                            !apiKeyInput.trim() || saveState === 'saving'
                          }
                          onClick={function onSave() {
                            void handleSaveApiKey()
                          }}
                        >
                          {saveState === 'saving'
                            ? '保存中…'
                            : saveState === 'saved'
                              ? (
                                  <>
                                    <EmojiIcon emoji="✓" size={12} /> 已保存
                                  </>
                                )
                              : '保存并连接'}
                        </Button>
                      </div>

                      {saveState === 'error' ? (
                        <p className="text-xs text-red-600">{saveError}</p>
                      ) : null}

                      {saveState === 'saved' ? (
                        <p className="text-xs text-green-600">
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            size={14}
                            strokeWidth={1.5}
                            className="inline mr-1"
                          />
                          API 密钥已保存。Hermes 正在重启以应用更改。
                        </p>
                      ) : null}
                    </div>

                    <a
                      href={selectedProvider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--theme-text)] underline decoration-primary-400 hover:text-[var(--theme-text)]"
                    >
                      <HugeiconsIcon
                        icon={Link01Icon}
                        size={20}
                        strokeWidth={1.5}
                      />
                      获取 {selectedProvider.name} API 密钥
                    </a>

                    <div className="mt-4 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/70 px-3 py-2">
                      <p className="text-xs text-[var(--theme-text)] text-pretty">
                        API 密钥仅存储在本地{' '}
                        <code className="font-mono">{HERMES_CONFIG_PATH}</code>
                        中，绝不会发送到 Studio。
                      </p>
                    </div>

                    {/* Manual fallback */}
                    <button
                      type="button"
                      onClick={function toggleManual() {
                        setShowManualSnippet(!showManualSnippet)
                      }}
                      className="mt-3 text-xs text-[var(--theme-muted)] hover:text-[var(--theme-text)] underline"
                    >
                      {showManualSnippet ? '隐藏' : '显示'}手动配置片段
                    </button>

                    {showManualSnippet ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={function onCopyConfig() {
                              void handleCopyConfig()
                            }}
                          >
                            <HugeiconsIcon
                              icon={Copy01Icon}
                              size={20}
                              strokeWidth={1.5}
                            />
                            复制片段
                          </Button>
                          {copyState === 'copied' ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <HugeiconsIcon
                                icon={Tick02Icon}
                                size={20}
                                strokeWidth={1.5}
                              />
                              已复制
                            </span>
                          ) : null}
                        </div>
                        <pre className="overflow-x-auto rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)]/80 p-3 text-xs text-[var(--theme-text)]">
                          <code className="font-mono tabular-nums">
                            {configExample}
                          </code>
                        </pre>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-primary-600 text-pretty">
                      无需额外配置 — 只需确保您的本地服务正在运行。
                    </p>
                  </>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={function onBack() {
                      setStep('auth')
                    }}
                  >
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      size={20}
                      strokeWidth={1.5}
                    />
                    返回
                  </Button>
                  {selectedAuthType === 'local' ? (
                    <Button
                      size="sm"
                      onClick={function onDone() {
                        handleDone()
                      }}
                    >
                      完成
                    </Button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {step === 'verify' ? (
              <section className="mt-5">
                <h3 className="text-base font-medium text-[var(--theme-text)] text-balance">
                  第 4 步：验证连接
                </h3>
                <div
                  className={cn(
                    'mt-3 rounded-2xl border p-4',
                    verifyBorderColor,
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-medium text-balance',
                      verifyIconColor,
                    )}
                  >
                    {verifyTitle}
                    {verifyState === 'success' ? (
                      <EmojiIcon emoji="✓" size={12} />
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm text-primary-600 text-pretty">
                    {verificationMessage || '正在等待 Hermes 响应…'}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={function onBack() {
                      setStep('instructions')
                    }}
                  >
                    <HugeiconsIcon
                      icon={ArrowLeft01Icon}
                      size={20}
                      strokeWidth={1.5}
                    />
                    返回
                  </Button>
                  <Button
                    size="sm"
                    onClick={function onDone() {
                      handleDone()
                    }}
                  >
                    完成
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  )
}
