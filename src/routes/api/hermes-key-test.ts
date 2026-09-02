/**
 * Hermes Key Test API — 真正校验 API Key 是否有效。
 *
 * 与"保存 key → 重启网关 → 看模型列表是否出现"的间接验证不同，本接口用
 * 该 key 向服务商真实发一次鉴权请求（GET {baseUrl}/models），按响应精确判定：
 *   2xx → key 有效；401/403 → key 无效；404 → 端点错误；超时/网络错误 → 不可达。
 *
 * 安全约束（方案 A 已确认）：
 *   - requireRole('admin')，仅管理员可调用
 *   - key 不落盘：请求体传入的 apiKey 仅用于本次在途请求，不写任何文件
 *   - key 不回显：响应体不含 key；未传 apiKey 时从 ~/.hermes/.env 读取（本地磁盘，已配置）
 */
import { createFileRoute } from '@tanstack/react-router'
import { requireRole } from '../../server/auth-middleware'
import { getHermesEnvPath, readEnvValueWithFallback } from '../../server/env-models'

const TEST_TIMEOUT_MS = 10_000

type TestEndpoint = {
  envKey?: string
  baseUrl: string
  modelsPath: string
  authHeader: string
  authPrefix?: string
  extraHeaders?: Record<string, string>
}

/** 服务商 → 测试端点映射（与 hermes-config.ts PROVIDERS / env-models.ts envKey 对齐） */
const PROVIDER_ENDPOINTS: Record<string, TestEndpoint> = {
  deepseek: {
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  dashscope: {
    envKey: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    modelsPath: '/models',
    authHeader: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  openrouter: {
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  zai: {
    envKey: 'GLM_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  kimi: {
    envKey: 'KIMI_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  'kimi-coding': {
    envKey: 'KIMI_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  minimax: {
    envKey: 'MINIMAX_API_KEY',
    baseUrl: 'https://api.minimax.io/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  'minimax-cn': {
    envKey: 'MINIMAX_CN_API_KEY',
    baseUrl: 'https://api.minimax.chat/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
}

function readApiKey(
  providerId: string,
  bodyKey: string | undefined,
): { key: string; source: 'request' | 'env' } {
  // 优先使用请求体传入的 key；否则回读本地 env（设置页"一键测通"已存 key 时使用）
  if (bodyKey && bodyKey.trim()) {
    return { key: bodyKey.trim(), source: 'request' }
  }
  const endpoint = PROVIDER_ENDPOINTS[providerId]
  if (endpoint?.envKey) {
    const envKey = readEnvValueWithFallback(endpoint.envKey, getHermesEnvPath())
    if (envKey) return { key: envKey, source: 'env' }
  }
  return { key: '', source: 'env' }
}

function describeStatus(status: number): string {
  if (status === 401) return 'API Key 无效（401 Unauthorized）'
  if (status === 403) return 'API Key 无权限或已被禁用（403 Forbidden）'
  if (status === 404) return '测试端点不存在（404），请检查 Base URL 是否正确'
  if (status === 400) return '请求被拒绝（400），可能是 Key 格式错误或 Base URL 不正确'
  if (status === 429) return '请求过于频繁（429），请稍后重试'
  return `服务商返回异常（HTTP ${status}）`
}

export const Route = createFileRoute('/api/hermes-key-test')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const body = (await request.json().catch(() => null)) as {
          provider?: string
          apiKey?: string
          baseUrl?: string
        } | null

        const providerId = (body?.provider || '').trim().toLowerCase()
        if (!providerId) {
          return Response.json(
            { ok: false, error: '缺少 provider 参数' },
            { status: 400 },
          )
        }

        const endpoint = PROVIDER_ENDPOINTS[providerId]
        if (!endpoint && !body?.baseUrl?.trim()) {
          return Response.json(
            {
              ok: false,
              error: `暂不支持测试服务商「${providerId}」，请提供自定义 Base URL。`,
            },
            { status: 400 },
          )
        }

        const { key, source } = readApiKey(providerId, body?.apiKey)
        if (!key) {
          return Response.json(
            {
              ok: false,
              source,
              error: '未找到该服务商的 API 密钥，请先添加并保存。',
            },
            { status: 404 },
          )
        }

        const baseUrl = (body?.baseUrl || endpoint?.baseUrl || '').replace(/\/+$/, '')
        const modelsPath = endpoint?.modelsPath || '/models'

        const headers: Record<string, string> = { ...(endpoint?.extraHeaders || {}) }
        if (endpoint?.authHeader) {
          headers[endpoint.authHeader] = `${endpoint.authPrefix || ''}${key}`
        } else {
          headers['Authorization'] = `Bearer ${key}`
        }

        try {
          const res = await fetch(`${baseUrl}${modelsPath}`, {
            headers,
            signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
          })

          const bodyText = await res.text().catch(() => '')
          if (!res.ok) {
            return Response.json({
              ok: false,
              source,
              status: res.status,
              error: describeStatus(res.status),
            })
          }

          // 2xx：key 有效。尝试统计模型数（不同服务商响应结构不同，解析失败不阻断）
          let modelCount: number | undefined
          try {
            const payload = JSON.parse(bodyText) as { data?: unknown }
            if (Array.isArray(payload.data)) modelCount = payload.data.length
          } catch {
            // 忽略解析失败
          }

          return Response.json({ ok: true, source, modelCount })
        } catch (err) {
          const aborted =
            typeof err === 'object' && err !== null && 'name' in err
              ? (err as { name?: string }).name === 'TimeoutError'
              : false
          return Response.json({
            ok: false,
            source,
            status: 0,
            error: aborted
              ? '连接超时，无法访问该服务商，请检查网络或 Base URL。'
              : '网络错误，无法访问该服务商，请检查网络或 Base URL。',
          })
        }
      },
    },
  },
})
