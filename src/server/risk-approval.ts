/**
 * 本地风险动作确认 / 审批请求管理（风险动作审批链）。
 *
 * 背景：Authorization Guard 对终端等高危动作的决策层（evaluateRiskAction /
 * assertTerminalAccess）已能识别 needs_confirmation / needs_approval 并抛错，
 * 但缺少「用户确认/审批 → 放行执行 → 回写」的完整链路。本模块承接这一环：
 *  - 门禁拦截时创建一条待确认/待审批请求（pending）；
 *  - 前端确认/审批后调用 resolveRiskApproval 落定（approved / denied）；
 *  - 批准后凭 grantToken（requestId）消费放行，支持 once / session / always 三档范围：
 *      - once：前端仅本次重试携带一次；
 *      - session：前端在本浏览器会话内持续携带；
 *      - always：直接写回 security.risk_controls 配置，移除该动作的确认/审批要求。
 *  - 每次落定经 recordAuthorizationDecision 沉淀进统一策略事件流（审计/画像）。
 *
 * 请求带 TTL（默认取策略 approvals.timeout，兜底 60s），过期即视为失效，
 * 防止「拦截后忘记响应」导致凭据长期滞留。
 */
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import YAML from 'yaml'
import { getHermesConfigPath } from './env-models'
import { recordAuthorizationDecision } from './policy-telemetry'

export type RiskApprovalDecision = 'needs_confirmation' | 'needs_approval'

export type RiskApprovalScope = 'once' | 'session' | 'always'

export type RiskApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired'

export interface RiskApprovalRequest {
  id: string
  /** 被守卫的高危动作（如 execute_shell）。 */
  action: string
  /** 受保护主体描述（如「打开终端（~/.hermes）」）。 */
  subject: string
  decision: RiskApprovalDecision
  status: RiskApprovalStatus
  /** 落定时的授权范围，仅 approved 时有意义。 */
  scope: RiskApprovalScope | null
  profileName: string | null
  createdAt: number
  expiresAt: number
  /** 批准后的消费次数（供统计，不做强制单次限制：session/always 需复用）。 */
  usedCount: number
}

export interface CreateRiskApprovalInput {
  action: string
  subject: string
  decision: RiskApprovalDecision
  profileName?: string | null
  ttlMs?: number
}

const DEFAULT_TTL_MS = 60_000
const MIN_TTL_MS = 15_000

const REQUESTS_KEY = '__hermes_risk_approval_requests__' as const

interface RequestStore {
  requests: Map<string, RiskApprovalRequest>
}

function getStore(): RequestStore {
  const globalStore = globalThis as { [REQUESTS_KEY]?: RequestStore }
  if (!globalStore[REQUESTS_KEY]) {
    globalStore[REQUESTS_KEY] = { requests: new Map() }
  }
  return globalStore[REQUESTS_KEY]
}

function isExpired(request: RiskApprovalRequest, now = Date.now()): boolean {
  return now > request.expiresAt
}

/**
 * 创建一条待确认/待审批请求。
 * 门禁命中 needs_confirmation / needs_approval 时调用，返回的 id 即放行凭据。
 */
export function createRiskApprovalRequest(
  input: CreateRiskApprovalInput,
): RiskApprovalRequest {
  const ttlMs = Math.max(MIN_TTL_MS, input.ttlMs ?? DEFAULT_TTL_MS)
  const now = Date.now()
  const request: RiskApprovalRequest = {
    id: randomUUID(),
    action: input.action,
    subject: input.subject,
    decision: input.decision,
    status: 'pending',
    scope: null,
    profileName: input.profileName ?? null,
    createdAt: now,
    expiresAt: now + ttlMs,
    usedCount: 0,
  }
  getStore().requests.set(request.id, request)
  return request
}

export function getRiskApprovalRequest(
  id: string,
): RiskApprovalRequest | undefined {
  const request = getStore().requests.get(id)
  if (!request) return undefined
  if (isExpired(request)) {
    request.status = 'expired'
    getStore().requests.delete(id)
    return request
  }
  return request
}

/**
 * 写回 security.risk_controls：移除指定动作的确认/审批要求（「始终允许」）。
 * 与 config-patch 的持久化口径一致：直接读写 HERMES_HOME 下 config.yaml。
 * 写失败（如文件被占/权限）不阻断审批结果，仅跳过持久化，避免执行链路被配置写入拖累。
 */
function persistAlwaysAllow(action: string): void {
  try {
    const configPath = getHermesConfigPath()
    const config = fs.existsSync(configPath)
      ? ((YAML.parse(fs.readFileSync(configPath, 'utf-8')) ?? {}) as Record<
          string,
          unknown
        >)
      : {}
    const security = (config.security ?? {}) as Record<string, unknown>
    const riskControls = (security.risk_controls ?? {}) as Record<
      string,
      unknown
    >
    const requireConfirmation = (riskControls.require_confirmation ??
      {}) as Record<string, unknown>
    const requireApproval = (riskControls.require_approval ??
      {}) as Record<string, unknown>
    delete requireConfirmation[action]
    delete requireApproval[action]
    riskControls.require_confirmation = requireConfirmation
    riskControls.require_approval = requireApproval
    security.risk_controls = riskControls
    config.security = security
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, YAML.stringify(config), 'utf-8')
  } catch {
    // 持久化失败不阻断审批，仅记录（降级为 session 级放行语义由前端自行判断）
  }
}

/**
 * 落定一条待审批请求：approved / denied + 授权范围。
 *  - approved + always：写回配置，移除该动作确认/审批要求；
 *  - 任一落定：经 recordAuthorizationDecision 沉淀统一策略事件流（审计/画像）。
 * 返回落定后的请求；请求不存在、已过期或已落定则返回 undefined。
 */
export function resolveRiskApproval(
  id: string,
  decision: 'approved' | 'denied',
  scope?: RiskApprovalScope | null,
): RiskApprovalRequest | undefined {
  const request = getRiskApprovalRequest(id)
  if (!request || request.status !== 'pending') return undefined

  const normalizedScope: RiskApprovalScope | null =
    decision === 'approved' ? (scope ?? 'once') : null
  request.status = decision === 'approved' ? 'approved' : 'denied'
  request.scope = normalizedScope

  if (decision === 'approved' && normalizedScope === 'always') {
    persistAlwaysAllow(request.action)
  }

  recordAuthorizationDecision({
    outcome: decision,
    approvalId: id,
    action: request.action,
    subject: request.subject,
    scope: normalizedScope,
    profileName: request.profileName,
    details: {
      decisionType: request.decision,
      channel: 'terminal',
    },
  })

  return request
}

/**
 * 消费放行凭据：校验请求已批准、未过期且动作匹配。
 * 命中即放行对应高危动作（终端会话创建）。不做强制单次消费，
 * session / always 范围内的复用由 TTL 与前端交互共同约束。
 */
export function consumeRiskApprovalGrant(
  id: string,
  action: string,
): boolean {
  const request = getRiskApprovalRequest(id)
  if (!request) return false
  if (request.status !== 'approved') return false
  if (request.action !== action) return false
  request.usedCount += 1
  return true
}

/** 测试辅助：清空全部请求（不影响其它模块状态）。 */
export function clearRiskApprovalRequests(): void {
  getStore().requests.clear()
}
