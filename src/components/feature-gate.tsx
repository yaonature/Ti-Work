/**
 * FeatureGate —— 路由级功能门禁包装。
 * 商业授权失败时呈现 FeatureLockedCard；技术失败（网关离线）由各页面自行提示。
 */
import type * as React from 'react'
import { useFeatureGate } from '@/hooks/use-feature-gate'
import { FeatureLockedCard } from '@/components/feature-locked-card'
import type { FeatureId } from '@/lib/feature-set'

export function FeatureGate({
  feature,
  children,
}: {
  feature: FeatureId
  children: React.ReactNode
}) {
  const { canUse, loading } = useFeatureGate()
  if (loading) return null
  if (!canUse(feature)) {
    return <FeatureLockedCard feature={feature} className="m-6" />
  }
  return <>{children}</>
}
