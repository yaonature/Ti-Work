/**
 * G6 gateway reload — pure logic (unit-testable in a node environment).
 *
 * Trigger a Hermes gateway reload after integration config is written: first probe health,
 * then fire reload requests at candidate endpoints in turn. Network side effects are
 * injected via parameters (probe / reloadRequest), and the three possible outcomes are
 * reported faithfully without fabricating gateway capabilities.
 */
export type ReloadStatus = 'reloaded' | 'reload-failed' | 'gateway-offline'

export interface ReloadResult {
  status: ReloadStatus
  detail: string
}

export type UrlProbe = (url: string) => Promise<boolean>

export interface ReloadResponse {
  ok: boolean
  status: number
}

export type ReloadRequest = (url: string) => Promise<ReloadResponse>

export interface ReloadGatewayOptions {
  baseUrl: string
  /** Health check path, default /health */
  healthUrl?: string
  /** Candidate reload endpoints (tried in order; any success returns) */
  reloadEndpoints: Array<string>
  probe: UrlProbe
  reloadRequest: ReloadRequest
}

export async function reloadGatewayConfig(
  opts: ReloadGatewayOptions,
): Promise<ReloadResult> {
  const healthUrl = opts.healthUrl ?? '/health'
  let healthy = false
  try {
    healthy = await opts.probe(`${opts.baseUrl}${healthUrl}`)
  } catch {
    healthy = false
  }
  if (!healthy) {
    return {
      status: 'gateway-offline',
      detail: `gateway offline at ${opts.baseUrl}`,
    }
  }

  const attempted: Array<string> = []
  for (const endpoint of opts.reloadEndpoints) {
    const url = `${opts.baseUrl}${endpoint}`
    attempted.push(endpoint)
    try {
      const res = await opts.reloadRequest(url)
      if (res.ok) {
        return {
          status: 'reloaded',
          detail: `重载端点 ${endpoint} → ${res.status}`,
        }
      }
    } catch {
      // Endpoint failed — try the next one
    }
  }

  return {
    status: 'reload-failed',
    detail: `没有可用的重载端点（已尝试 ${attempted.length} 个：${attempted.join(', ')}）`,
  }
}
