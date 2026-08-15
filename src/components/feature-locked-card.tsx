/**
 * FeatureLockedCard —— 付费能力锁定卡片。
 * 门禁公式：功能可用 = 商业授权可用 && 技术能力可用。
 * 本组件承接"商业授权失败"时的呈现：锁定说明 + 升级 CTA。
 */
import { HugeiconsIcon } from '@hugeicons/react'
import { LockIcon, SparklesIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  FEATURE_LABELS,
  PLAN_META,
  type FeatureId,
} from '@/lib/feature-set'

export function FeatureLockedCard({
  feature,
  className,
  compact,
}: {
  feature: FeatureId
  className?: string
  compact?: boolean
}) {
  const label = FEATURE_LABELS[feature]
  const upgradeTo =
    feature === 'audit' ||
    feature === 'team-learning' ||
    feature === 'floating-seats'
      ? PLAN_META.professional
      : PLAN_META.standard

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-bg)]/40 px-6 text-center',
        compact ? 'py-6' : 'py-12',
        className,
      )}
    >
      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--theme-panel)] text-[var(--theme-muted)]">
        <HugeiconsIcon icon={LockIcon} size={20} strokeWidth={1.5} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--theme-text)]">
          {label}属于{upgradeTo.name}能力
        </p>
        <p className="text-xs text-[var(--theme-muted)]">
          {upgradeTo.tagline}。升级后立即解锁，无需重装。
        </p>
      </div>
      <Button size={compact ? 'sm' : 'default'} onClick={openUpgrade}>
        <HugeiconsIcon
          icon={SparklesIcon}
          size={16}
          strokeWidth={1.5}
          className="mr-1.5"
        />
        升级{upgradeTo.name}
      </Button>
    </div>
  )
}

function openUpgrade(): void {
  // 批次 3 收口：升级入口统一跳转账号中心订阅引导
  const settingsUrl = new URL('/settings', window.location.origin)
  settingsUrl.searchParams.set('section', 'account')
  window.location.href = settingsUrl.toString()
}
