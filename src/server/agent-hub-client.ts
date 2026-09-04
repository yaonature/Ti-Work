/**
 * Agent Unified Hub Client
 *
 * 桌面端所有对 Hermes 网关的 HTTP 访问收敛到这一层——统一负责：
 *   - Bearer token 注入（统一读取 API_SERVER_KEY，见 gateway-capabilities.authHeaders）
 *   - 网关 baseUrl 拼接
 *   - 可选超时
 *   - 统一错误归一化（GatewayError：status / path / method / body）
 *
 * 分层约定（保证无循环依赖）：
 *   gateway-capabilities 是「能力探测」地基，负责 HERMES_API、token、authHeaders、
 *   probe/getCapabilities。本模块从其上单向取值，不反向引用它内部实现。
 *   各 server 路由 / 模块不再手写 fetch(HERMES_API) 与鉴权样板，统一经本模块访问。
 */
import {
  HERMES_API,
  authHeaders,
  ensureGatewayProbed,
  getCapabilities,
  isGatewayReachable,
} from './gateway-capabilities'
import type { GatewayCapabilities } from './gateway-capabilities'

// ── Types ─────────────────────────────────────────────────────────

export type GatewayMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type GatewayFetchOptions = {
  method?: GatewayMethod
  /**
   * JSON 对象会被 stringify 并默认注入 application/json；
   * string / ArrayBuffer / Uint8Array / ReadableStream 原样透传，不擅改 content-type。
   */
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  /** 不注入默认 Bearer（透传请求本身已携带鉴权时使用） */
  skipAuth?: boolean
  /** 附加到路径后的查询串（可带可不带 '?'） */
  search?: string
  /** fetch 重定向策略（透传代理需 manual 时使用；默认跟随）。 */
  redirect?: 'follow' | 'error' | 'manual'
}

/** 网关请求统一错误：携带 HTTP 状态、目标路径、请求方法与响应体。 */
export class GatewayError extends Error {
  readonly status: number
  readonly path: string
  readonly method: GatewayMethod
  readonly body: string

  constructor(
    method: GatewayMethod,
    path: string,
    status: number,
    body: string,
  ) {
    const trimmed = body.trim()
    super(
      `Gateway ${method} ${path}: ${status}${trimmed ? ` ${trimmed}` : ''}`,
    )
    this.name = 'GatewayError'
    this.status = status
    this.path = path
    this.method = method
    this.body = body
  }
}

// ── URL assembly & auth ───────────────────────────────────────────

/** 拼接网关绝对 URL。path 需以 / 开头（可选），search 为查询串或 ''。 */
export function gatewayUrl(path: string, search?: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  const query = search?.replace(/^\?/, '')
  return `${HERMES_API}${clean}${query ? `?${query}` : ''}`
}

/** 统一 Bearer 头（单一来源 = gateway-capabilities.authHeaders）。 */
export function gatewayAuthHeaders(): Record<string, string> {
  return authHeaders()
}

// ── Low-level fetch ───────────────────────────────────────────────

function isStreamLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.getReader === 'function' || typeof record.pipe === 'function'
  )
}

function isBinaryLike(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}

/**
 * 统一网关 fetch：自动注入 Bearer、拼接 URL、可选超时。
 * 返回原始 Response，供 JSON / 文本 / SSE / 透传等调用方按需消费。
 */
export async function gatewayFetch(
  path: string,
  opts: GatewayFetchOptions = {},
): Promise<Response> {
  const method = opts.method ?? 'GET'
  const url = gatewayUrl(path, opts.search)

  const headers = new Headers(opts.headers)
  if (!opts.skipAuth) {
    for (const [key, value] of Object.entries(authHeaders())) {
      if (!headers.has(key)) headers.set(key, value)
    }
  }

  let body: BodyInit | undefined
  if (opts.body !== undefined) {
    const raw = opts.body
    if (typeof raw === 'string' || isBinaryLike(raw) || isStreamLike(raw)) {
      body = raw as BodyInit
    } else {
      body = JSON.stringify(raw)
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json')
      }
    }
  }

  let signal = opts.signal
  if (!signal && opts.timeoutMs) {
    signal = AbortSignal.timeout(opts.timeoutMs)
  }

  return fetch(url, { method, headers, body, signal, redirect: opts.redirect })
}

/** 统一 JSON 请求：非 2xx 时抛 GatewayError（响应体原文保留在 err.body）。 */
export async function gatewayJson<T = unknown>(
  path: string,
  opts: GatewayFetchOptions = {},
): Promise<T> {
  const method = opts.method ?? 'GET'
  const res = await gatewayFetch(path, opts)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new GatewayError(method, path, res.status, text)
  }
  return res.json() as Promise<T>
}

// ── Capability-aware helpers ──────────────────────────────────────

/** 确保网关已探测（供调用方在发起请求前统一调用）。 */
export async function ensureAgentGatewayProbed(): Promise<GatewayCapabilities> {
  return ensureGatewayProbed()
}

/** 读取当前已缓存的能力集。 */
export function getAgentCapabilities(): GatewayCapabilities {
  return getCapabilities()
}

/** 网关是否可达（不重探）。 */
export function isAgentGatewayReachable(): boolean {
  return isGatewayReachable()
}

export { HERMES_API }
