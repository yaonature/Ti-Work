import { publishChatEvent } from './chat-event-bus'
import { updateHabitProfile } from './habit-profile'
import { ingestManualDecision } from './habit-sequences'

export type PolicySource = 'directory' | 'website' | 'terminal' | 'approval'

export type PolicyResult =
  | 'allowed'
  | 'denied'
  | 'needs_confirmation'
  | 'needs_approval'

export interface UnifiedPolicyDecision {
  source: PolicySource
  result: PolicyResult
  action: string
  subject: string | null
  reason: string
  profileName: string | null
  details: Record<string, unknown>
  ts: number
}

export interface PolicyTelemetryQuery {
  limit?: number
  source?: PolicySource
  result?: PolicyResult
}

const QUEUE_KEY = '__hermes_policy_telemetry_queue__' as const
const QUEUE_CAPACITY = 500

interface QueueState {
  decisions: Array<UnifiedPolicyDecision>
}

function getQueue(): QueueState {
  const globalQueue = globalThis as { [QUEUE_KEY]?: QueueState }
  if (!globalQueue[QUEUE_KEY]) {
    globalQueue[QUEUE_KEY] = { decisions: [] }
  }
  return globalQueue[QUEUE_KEY]
}

function pushDecision(decision: UnifiedPolicyDecision): void {
  const { decisions } = getQueue()
  decisions.push(decision)
  if (decisions.length > QUEUE_CAPACITY) {
    decisions.splice(0, decisions.length - QUEUE_CAPACITY)
  }
}

/**
 * 发布一条统一策略决策。
 *
 * 目录 / 网站 / 终端 / 审批等所有守卫的放行、拒绝、需确认、需审批结果都汇入
 * 这一单一漏斗，审计与行为沉淀因此消费一条归一化事件流
 * （`desktop.policy_decision`），而非按守卫各自命名空间分散。
 */
export function publishPolicyDecision(input: {
  source: PolicySource
  result: PolicyResult
  action: string
  subject: string | null
  reason: string
  profileName?: string | null
  details?: Record<string, unknown>
}): UnifiedPolicyDecision {
  const decision: UnifiedPolicyDecision = {
    source: input.source,
    result: input.result,
    action: input.action,
    subject: input.subject,
    reason: input.reason,
    profileName: input.profileName ?? null,
    details: input.details ?? {},
    ts: Date.now(),
  }

  pushDecision(decision)

  // 在广播前将决策并入本地画像（画像提炼），即使活跃 run 期间总线丢弃了广播，
  // 审计事件与画像仍保持一致。
  updateHabitProfile(decision)

  // P1-A 辅助线：将手动守卫（目录/网站/终端）的落地决策并入时间窗动作组，
  // 供会话任务序列沉淀（habit-sequences，sessionKey 可空契约）。审批来源与
  // needs_confirmation 中间态在 ingestManualDecision 内部过滤，不进序列。
  ingestManualDecision(decision)

  publishChatEvent('desktop.policy_decision', {
    sessionKey: 'all',
    ...decision,
  })

  return decision
}

export function getPolicyTelemetry(
  options?: PolicyTelemetryQuery,
): Array<UnifiedPolicyDecision> {
  const { decisions } = getQueue()
  const filtered =
    options?.source || options?.result
      ? decisions.filter(
          (item) =>
            (options?.source ? item.source === options.source : true) &&
            (options?.result ? item.result === options.result : true),
        )
      : decisions
  const limit = options?.limit ?? 100
  return filtered.slice(-limit)
}

export function clearPolicyTelemetry(): void {
  getQueue().decisions = []
}

// ─── 授权确认 / 用户纠偏事件沉淀 ─────────────────────────────────────────

export type AuthorizationOutcome = 'approved' | 'denied'

/**
 * 用户相对守卫自动化判定结果的立场。
 * - `confirmed`：用户认可一次放行或确认提示。
 * - `rejected`：用户拒绝了确认提示。
 * - `corrected`：用户做出了与守卫明确放行/拦截相反的决定（纠偏）。
 */
export type AuthorizationDisposition = 'confirmed' | 'rejected' | 'corrected'

export interface AuthorizationDecisionInput {
  outcome: AuthorizationOutcome
  /** 云端审批 id，形如 "<sessionKey>:<uuid>"，为一级关联键。 */
  approvalId?: string | null
  /** 被守卫的底层动作（如 execute_shell、navigate、read）。 */
  action?: string | null
  /** 受保护的主体（文件路径 / 域名 / 命令）。 */
  subject?: string | null
  /** 审批持久化范围：once | session | always。 */
  scope?: 'once' | 'session' | 'always' | string | null
  profileName?: string | null
  details?: Record<string, unknown>
}

/** 查找最近一条相关决策，用于关联用户立场。 */
function findRelatedDecision(
  input: AuthorizationDecisionInput,
): UnifiedPolicyDecision | undefined {
  const { decisions } = getQueue()
  const keys = new Set<string>()
  if (input.approvalId) keys.add(input.approvalId)
  if (input.subject) keys.add(input.subject)
  if (input.action) keys.add(input.action)
  if (keys.size === 0) return undefined

  for (let i = decisions.length - 1; i >= 0; i -= 1) {
    const candidate = decisions[i]
    // 跳过用户自身的最终决策（source=approval 且结果为明确放行/拒绝）。
    // 只有守卫决策或仍在途的审批提示才有资格作为“先序自动立场”进行关联。
    if (candidate.source === 'approval') {
      if (candidate.result === 'allowed' || candidate.result === 'denied') {
        continue
      }
    }
    if (candidate.subject && keys.has(candidate.subject)) return candidate
  }
  return undefined
}

function deriveDisposition(
  outcome: AuthorizationOutcome,
  prior: UnifiedPolicyDecision | undefined,
): AuthorizationDisposition {
  if (prior) {
    if (outcome === 'approved' && prior.result === 'denied') return 'corrected'
    if (outcome === 'denied' && prior.result === 'allowed') return 'corrected'
  }
  return outcome === 'approved' ? 'confirmed' : 'rejected'
}

/**
 * 将用户的授权响应（approve/deny）写入统一事件流。会与守卫先前的决策
 * （按 subject / approvalId 匹配）关联，将结果标记为 confirmed / rejected /
 * corrected，便于行为画像从显式用户纠偏中学习。
 */
export function recordAuthorizationDecision(
  input: AuthorizationDecisionInput,
): { disposition: AuthorizationDisposition; decision: UnifiedPolicyDecision } {
  const prior = findRelatedDecision(input)
  const disposition = deriveDisposition(input.outcome, prior)

  const decision = publishPolicyDecision({
    source: 'approval',
    result: input.outcome === 'approved' ? 'allowed' : 'denied',
    action: input.action || prior?.action || 'authorization',
    subject: input.approvalId || input.subject || input.action || null,
    reason: disposition,
    profileName: input.profileName ?? null,
    details: {
      disposition,
      approvalId: input.approvalId ?? null,
      scope: input.scope ?? null,
      ...(prior
        ? {
            correlated: {
              source: prior.source,
              result: prior.result,
              action: prior.action,
            },
          }
        : {}),
      ...input.details,
    },
  })

  return { disposition, decision }
}
