import { createFileRoute } from '@tanstack/react-router'
import {
  getGatewayOfflineMessage,
  getHermesApiToken,
  HERMES_API,
} from '../../../server/gateway-capabilities'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getLiveBootstrapState } from '../../../server/hermes-bootstrap'
import {
  getEnvConfiguredModels,
  type EnvModelEntry,
} from '../../../server/env-models'
import { applyEnterpriseModelAllowlist } from '../../../server/enterprise-models'

/**
 * 网关不可达时的错误文案：感知自举安装状态（安装中/启动中/失败），
 * 给出针对性提示，避免用户困惑于"请先安装并启动 hermes --gateway"。
 */
function buildOfflineErrorMessage(): string {
  try {
    const state = getLiveBootstrapState()
    if (state.phase === 'detecting' || state.phase === 'installing') {
      const progress =
        state.stageIndex >= 0 && state.stages.length > 0
          ? `（${Math.min(state.stageIndex + 1, state.stages.length)}/${state.stages.length}）`
          : ''
      return `执行引擎正在安装中${progress}，请稍候…安装完成后自动连接（可在顶部横幅查看进度）。`
    }
    if (state.phase === 'configuring' || state.phase === 'starting') {
      return '执行引擎正在启动中，请稍候…'
    }
    if (state.phase === 'failed') {
      return `执行引擎安装未完成：${state.error || '未知原因'}。请点击顶部横幅「一键连接」重试。`
    }
  } catch {
    /* 读取失败时回退到默认文案 */
  }
  return getGatewayOfflineMessage()
}

/**
 * 网关不可达时，模型列表类接口返回 env 中已配置 Key 的服务商兜底模型，
 * 避免聊天页模型选择器在离线时显示"没有可用模型"。
 */
function buildModelFallbackResponse(targetPath: string): Response | null {
  const isAvailableModels = targetPath.includes('/api/available-models')
  const isV1Models = targetPath.includes('/v1/models')
  if (!isAvailableModels && !isV1Models) return null

  const envModels = getEnvConfiguredModels()
  const allowedModels = applyEnterpriseModelAllowlist(envModels)
  const jsonHeaders = { 'content-type': 'application/json' }

  if (isAvailableModels) {
    const providers: Array<{ id: string; label: string; authenticated: boolean }> =
      []
    const seen = new Set<string>()
    for (const m of allowedModels) {
      if (m.provider && !seen.has(m.provider)) {
        seen.add(m.provider)
        providers.push({ id: m.provider, label: m.provider, authenticated: true })
      }
    }
    return new Response(
      JSON.stringify({
        provider: '',
        models: allowedModels.map((m: EnvModelEntry) => ({
          id: m.id,
          name: m.name,
          description: m.name,
        })),
        providers,
        fallback: true,
      }),
      { status: 200, headers: jsonHeaders },
    )
  }

  return new Response(
    JSON.stringify({
      object: 'list',
      data: allowedModels.map((m: EnvModelEntry) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
      })),
      fallback: true,
    }),
    { status: 200, headers: jsonHeaders },
  )
}

async function proxyRequest(request: Request, splat: string) {
  const incomingUrl = new URL(request.url)
  const targetPath = splat.startsWith('/') ? splat : `/${splat}`
  const targetUrl = new URL(`${HERMES_API}${targetPath}`)
  targetUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  const token = getHermesApiToken()
  if (token && !headers.has('authorization')) {
    headers.set('authorization', `Bearer ${token}`)
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    init.body = await request.text()
  }

  let upstream: Response
  try {
    upstream = await fetch(targetUrl, init)
  } catch {
    // 网关不可达（未安装 / 未启动）：模型列表类接口降级返回 env 兜底模型
    const fallback = buildModelFallbackResponse(targetPath)
    if (fallback) return fallback
    throw new Error(buildOfflineErrorMessage())
  }
  const body = await upstream.text()
  const responseHeaders = new Headers()
  const contentType = upstream.headers.get('content-type')
  if (contentType) responseHeaders.set('content-type', contentType)

  // 网关在线：模型列表类接口同样应用企业白名单（企业模型管控）
  const isModelList =
    targetPath.includes('/api/available-models') ||
    targetPath.includes('/v1/models')
  if (isModelList && upstream.ok) {
    try {
      const parsed = JSON.parse(body) as { data?: Array<{ id: string }>; models?: Array<{ id: string }> }
      const models = parsed.data ?? parsed.models ?? []
      const allowed = applyEnterpriseModelAllowlist(models)
      if (allowed.length !== models.length) {
        if (Array.isArray(parsed.data)) parsed.data = allowed
        if (Array.isArray(parsed.models)) parsed.models = allowed
        return new Response(JSON.stringify(parsed), {
          status: upstream.status,
          headers: responseHeaders,
        })
      }
    } catch {
      // 非 JSON 响应原样透传
    }
  }

  return new Response(body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export const Route = createFileRoute('/api/hermes-proxy/$')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      POST: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      PATCH: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            { status: 401, headers: { 'content-type': 'application/json' } },
          )
        }
        return proxyRequest(request, params._splat || '')
      },
    },
  },
})
