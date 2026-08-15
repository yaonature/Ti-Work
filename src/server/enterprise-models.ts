/**
 * 企业模型白名单过滤（批次 4：企业版 UI 收口）。
 *
 * 企业中枢接入时，登录响应可携带 enterprise.modelAllowlist，服务端在此统一
 * 过滤模型列表响应（网关在线 + 网关离线 fallback 两条路径都过同一过滤器），
 * 用户端只能看到白名单内模型 → 企业模型管控。
 *
 * 注意：白名单只在"中枢已接入且下发了白名单"时生效；单机版（无中枢）不受影响。
 */
import { hubStatus } from './hub-client'

/** 按企业白名单过滤模型 id 列表；无白名单时原样返回（保持原类型） */
export function applyEnterpriseModelAllowlist<T extends { id: string }>(
  models: Array<T>,
): Array<T> {
  const allowlist = hubStatus().enterprise?.modelAllowlist
  if (!allowlist || allowlist.length === 0) return models
  const allowed = new Set(allowlist.map((id) => id.trim()).filter(Boolean))
  if (allowed.size === 0) return models
  return models.filter((m) => allowed.has(m.id))
}
