/**
 * 域名归一化工具，供授权守卫与画像聚合器共用。
 * 独立成模块是为了让下游消费者（如 habit-profile）在不经由
 * policy-telemetry 造成循环依赖的情况下复用。
 */

export function normalizeDomain(url: string): string {
  const trimmed = String(url || '').trim().toLowerCase()
  const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//, '')
  const hostPort = withoutProtocol.split(/[/?#]/)[0]
  const host = hostPort.split(':')[0]
  return host.replace(/^www\./, '')
}

export function isDomainWithinScope(
  targetHost: string,
  scopeDomain: string,
): boolean {
  const host = normalizeDomain(targetHost)
  const domain = normalizeDomain(scopeDomain)
  return host === domain || host.endsWith(`.${domain}`)
}
