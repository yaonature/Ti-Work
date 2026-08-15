import { Alert02Icon, LinkSquare02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

type Props = {
  feature: string
  description?: string
}

export function BackendUnavailableState({ feature, description }: Props) {
  const openOnboarding = () => {
    window.dispatchEvent(new CustomEvent('hermes:open-onboarding'))
  }

  return (
    <div className="flex h-full min-h-[320px] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[20px] border border-[var(--theme-border)] bg-[var(--theme-panel)] p-8 text-center shadow-[var(--theme-shadow-2)]">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-accent)] shadow-sm">
          <HugeiconsIcon icon={Alert02Icon} size={24} strokeWidth={1.7} />
        </div>
        <div className="mt-4 space-y-2">
          <h2 className="text-lg font-semibold text-[var(--theme-text)]">{feature}</h2>
          <p className="text-sm leading-6 text-[var(--theme-muted)]">
            当前后端不支持该功能。连接 Hermes 网关即可解锁{' '}
            {feature}。
          </p>
          {description ? (
            <p className="text-xs leading-5 text-[var(--theme-muted)]">{description}</p>
          ) : null}
          <div className="!mt-5">
            <button
              type="button"
              onClick={openOnboarding}
              className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600"
            >
              <HugeiconsIcon icon={LinkSquare02Icon} size={16} strokeWidth={2} />
              连接 Hermes 网关
            </button>
            <p className="mt-3 text-xs leading-5 text-[var(--theme-muted)]">
              无需配置：跟随引导连接后端，即可解锁增强功能。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BackendUnavailableState
