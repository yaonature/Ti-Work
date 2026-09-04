/**
 * Agent Unified Access Layer
 *
 * 桌面端所有 Agent 网关入口（server 路由 / 模块）统一经本层做「访问裁决 + 上下文注入」。
 *
 * 职责（对应蓝图 DESK-02）：
 *   1. 鉴权守卫：覆盖双轨鉴权（cookie 用户态）与角色约束，返回标准 401/403。
 *   2. 网关守卫：自动 ensureGatewayProbed，并按需校验具体能力（能力缺失 → 503）。
 *   3. 上下文注入：生成 traceId，携带当前用户 / 角色 / 数据归属者，供下行调用透传。
 *   4. 统一 runId / traceId / taskId：traceId 由本层自动生成；runId / taskId 由
 *      具体调用方在已知时随请求透传（见 AgentRequestContext 可选字段）。
 *
 * 边界：本层只做「裁决 + 上下文」，不做网关 HTTP 请求。HTTP 访问统一走
 *   agent-hub-client.gatewayFetch / gatewayJson（URL 拼接、Bearer 注入、错误归一化）。
 *   企业 / 品牌上下文需依赖 OPC 云端注入，当前工作区尚未接入，预留字段由调用方在
 *   云端可用后再填充，本层不伪造占位数据。
 *
 * 依赖方向（无循环依赖）：
 *   agent-unified-access → agent-hub-client → gateway-capabilities
 *   agent-unified-access → auth-middleware → identity
 */
import { randomUUID } from 'node:crypto'
import {
  ensureAgentGatewayProbed,
  getAgentCapabilities,
  isAgentGatewayReachable,
} from './agent-hub-client'
import {
  getEffectiveSessionOwner,
  getUserIdFromRequest,
  getUserRoleFromRequest,
  requireAuth,
  requireRole,
} from './auth-middleware'
import type { RequiredRole } from './auth-middleware'
import type { GatewayCapabilities } from './gateway-capabilities'
import type { UserRole } from './identity'

// ── Types ─────────────────────────────────────────────────────────

export type AgentAccessOptions = {
  /** 需要的最低角色；'admin' 仅 super_admin 通过（单用户模式恒通过） */
  role?: RequiredRole
  /** 需要网关具备的某项能力（缺失 → 503），如 'jobs' / 'sessions' */
  capability?: keyof GatewayCapabilities
  /** 能力缺失时的 503 提示文案；默认给通用提示 */
  capabilityMessage?: string
}

/**
 * 请求上下文：一次 Agent 访问共享的标识与身份信息。
 * - traceId：由本层自动生成（RFC4122 v4），贯穿链路日志。
 * - runId / taskId：调用方在已知的前提下透传，遵守「统一 runId/traceId/taskId」。
 * - 企业 / 品牌层（enterpriseId / brandId）：预留，云端接入后再填充。
 */
export type AgentRequestContext = {
  userId?: string
  role: UserRole
  scopeOwner?: string
  traceId: string
  runId?: string
  taskId?: string
  gateway: GatewayCapabilities
  gatewayReachable: boolean
}

const DEFAULT_CAPABILITY_MESSAGE =
  '网关能力不可用——请确认执行引擎已启动并升级到最新版本后重试。'

/**
 * 访问裁决：鉴权不通过返回 401/403 Response；能力缺失返回 503 Response；
 * 全部通过则返回构造好的 AgentRequestContext。
 *
 * 调用方约定：
 *   const ctx = await requireAgentAccess(request, { role: 'admin', capability: 'jobs' })
 *   if (ctx instanceof Response) return ctx
 *   // 后续使用 ctx.traceId / ctx.role，并经 gatewayFetch / gatewayJson 发起访问
 */
export async function requireAgentAccess(
  request: Request,
  opts: AgentAccessOptions = {},
): Promise<Response | AgentRequestContext> {
  const guard = opts.role
    ? requireRole(request, opts.role)
    : requireAuth(request)
  if (guard) return guard

  await ensureAgentGatewayProbed()
  const gateway = getAgentCapabilities()

  if (opts.capability && !gateway[opts.capability]) {
    return Response.json(
      { ok: false, error: opts.capabilityMessage ?? DEFAULT_CAPABILITY_MESSAGE },
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return {
    userId: getUserIdFromRequest(request),
    role: getUserRoleFromRequest(request),
    scopeOwner: getEffectiveSessionOwner(request),
    traceId: randomUUID(),
    gateway,
    gatewayReachable: isAgentGatewayReachable(),
  }
}

/** 便于调用方在拿到 Response | Context 时做窄化（可选，用于可读性）。 */
export function isAgentAccessDenied(
  result: Response | AgentRequestContext,
): result is Response {
  return result instanceof Response
}
