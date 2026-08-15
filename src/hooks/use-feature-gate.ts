/**
 * 前端功能门禁 hook —— 基于中枢 featureSet 推导当前计划，提供 canUse(feature)。
 *
 * 单机版（无中枢配置）恒为 free：本地全功能不受限制（软登录原则），
 * 仅"高级能力"（integrations/orchestration/multi-agent/audit…）在 UI 上
 * 呈现升级 CTA；企业中枢接入后按下发 featureSet 实时解锁。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  canUsePlan,
  derivePlanFromFeatureSet,
  type FeatureId,
  type PlanId,
} from '@/lib/feature-set'

export interface FeatureGateState {
  plan: PlanId
  /** 是否为企业中枢下发（false = 单机版本地） */
  fromHub: boolean
  featureSet: Array<string>
  /** 加载中（首帧避免闪烁锁定/解锁状态） */
  loading: boolean
}

export function useFeatureGate(): FeatureGateState & {
  canUse: (feature: FeatureId) => boolean
} {
  const [state, setState] = useState<FeatureGateState>({
    plan: 'free',
    fromHub: false,
    featureSet: [],
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/hub')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { status?: { featureSet?: Array<string> } } | null) => {
        if (cancelled) return
        const featureSet = d?.status?.featureSet ?? []
        setState({
          plan: derivePlanFromFeatureSet(featureSet),
          fromHub: featureSet.length > 0,
          featureSet,
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const canUse = useCallback(
    (feature: FeatureId): boolean => canUsePlan(state.plan, feature),
    [state.plan],
  )

  return { ...state, canUse }
}
