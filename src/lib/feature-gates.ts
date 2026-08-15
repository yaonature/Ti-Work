import { getCapabilities } from '../server/gateway-capabilities'

export type EnhancedFeature =
  | 'sessions'
  | 'skills'
  | 'memory'
  | 'config'
  | 'jobs'

const FEATURE_LABELS: Record<EnhancedFeature, string> = {
  sessions: '会话',
  skills: '技能',
  memory: '记忆',
  config: '配置',
  jobs: '定时任务',
}

function normalizeFeature(
  feature: EnhancedFeature | string,
): EnhancedFeature | null {
  const normalized = feature.trim().toLowerCase()
  if (
    normalized === 'sessions' ||
    normalized === 'skills' ||
    normalized === 'memory' ||
    normalized === 'config' ||
    normalized === 'jobs'
  ) {
    return normalized
  }

  return null
}

export function isFeatureAvailable(feature: EnhancedFeature): boolean {
  const caps = getCapabilities()
  return caps[feature] === true
}

export function getFeatureLabel(feature: EnhancedFeature | string): string {
  const normalized = normalizeFeature(feature)
  if (!normalized) return feature
  return FEATURE_LABELS[normalized]
}

export function getUnavailableReason(
  feature: EnhancedFeature | string,
): string {
  return `${getFeatureLabel(feature)}需要连接支持增强 API 的 Hermes 网关。`
}

export function createCapabilityUnavailablePayload(
  feature: EnhancedFeature,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ok: false,
    code: 'capability_unavailable',
    capability: feature,
    source: 'portable',
    message: getUnavailableReason(feature),
    ...extra,
  }
}
