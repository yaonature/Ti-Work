/**
 * Config Patch API — 写 ~/.hermes/config.yaml 并尝试热重载网关。
 *
 * 两种请求体（与现有调用方契约一致）：
 *  1. { raw, reason }  —— raw 为 JSON 字符串，深合并进现有配置（provider-wizard 保存 API Key 用）
 *  2. { path, value }  —— 按点路径写入单个配置项（providers-screen 通用设置用；value 为 null 时删除）
 *
 * 写入后对网关发起 reload（/api/config/reload、/config/reload），结果随响应返回，
 * 供前端提示"已生效 / 需重启网关"。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import { requireRole } from '../../server/auth-middleware'
import { getHermesApiToken, HERMES_API } from '../../server/gateway-capabilities'
import { reloadGatewayConfig } from '../../server/gateway-reload'
import type { ReloadResult } from '../../server/gateway-reload'
import { getHermesConfigPath, getHermesEnvPath } from '../../server/env-models'

const CONFIG_PATH = getHermesConfigPath()
const ENV_PATH = getHermesEnvPath()
const HERMES_HOME = path.dirname(CONFIG_PATH)

const RELOAD_ENDPOINTS = ['/api/config/reload', '/config/reload']
const PROBE_TIMEOUT_MS = 3_000

function readConfig(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return (YAML.parse(raw) as Record<string, unknown>) || {}
  } catch {
    return {}
  }
}

function writeConfig(config: Record<string, unknown>): void {
  fs.mkdirSync(HERMES_HOME, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, YAML.stringify(config), 'utf-8')
}

function readEnv(): Record<string, string> {
  try {
    const raw = fs.readFileSync(ENV_PATH, 'utf-8')
    const env: Record<string, string> = {}
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const index = trimmed.indexOf('=')
      if (index <= 0) continue
      const key = trimmed.slice(0, index).trim()
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
    return env
  } catch {
    return {}
  }
}

function writeEnv(env: Record<string, string>): void {
  fs.mkdirSync(HERMES_HOME, { recursive: true })
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`)
  fs.writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf-8')
}

/** 深合并：source 中的对象逐层并入 target，标量直接覆盖 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      )
    } else {
      target[key] = value
    }
  }
}

/** 按点路径设置/删除单个配置项，如 { path: 'model', value: 'claude-3-5' } */
function applyPathUpdate(
  config: Record<string, unknown>,
  pathExpr: string,
  value: unknown,
): void {
  const segments = pathExpr.split('.').filter(Boolean)
  if (segments.length === 0) return
  let cursor: Record<string, unknown> = config
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]
    const next = cursor[key]
    if (typeof next !== 'object' || next === null || Array.isArray(next)) {
      const fresh: Record<string, unknown> = {}
      cursor[key] = fresh
      cursor = fresh
    } else {
      cursor = next as Record<string, unknown>
    }
  }
  const last = segments[segments.length - 1]
  if (value === null) {
    delete cursor[last]
  } else {
    cursor[last] = value
  }
}

async function tryReloadGateway(): Promise<ReloadResult | null> {
  try {
    const token = getHermesApiToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    return await reloadGatewayConfig({
      baseUrl: HERMES_API,
      reloadEndpoints: RELOAD_ENDPOINTS,
      probe: async (url) => {
        try {
          const res = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
          })
          return res.ok
        } catch {
          return false
        }
      },
      reloadRequest: async (url) => {
        const res = await fetch(url, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        })
        return { ok: res.ok, status: res.status }
      },
    })
  } catch {
    return null
  }
}

export const Route = createFileRoute('/api/config-patch')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const roleGuard = requireRole(request, 'admin')
        if (roleGuard) return roleGuard

        const body = (await request.json()) as Record<string, unknown>
        const config = readConfig()

        // 1. { raw } 整段深合并
        if (typeof body.raw === 'string') {
          let raw: unknown
          try {
            raw = JSON.parse(body.raw)
          } catch {
            return Response.json(
              { ok: false, error: 'raw 不是合法的 JSON 字符串' },
              { status: 400 },
            )
          }
          if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            return Response.json(
              { ok: false, error: 'raw 必须是 JSON 对象' },
              { status: 400 },
            )
          }
          deepMerge(config, raw as Record<string, unknown>)
        }

        // 2. { path, value } 单点更新
        if (typeof body.path === 'string' && body.path.trim()) {
          applyPathUpdate(config, body.path.trim(), body.value)
        }

        let envChanged = false
        if (body.env && typeof body.env === 'object' && !Array.isArray(body.env)) {
          const env = readEnv()
          for (const [key, value] of Object.entries(body.env as Record<string, unknown>)) {
            if (typeof value !== 'string') continue
            env[key] = value
            envChanged = true
          }
          if (envChanged) writeEnv(env)
        }

        if (typeof body.raw !== 'string' && typeof body.path !== 'string' && !envChanged) {
          return Response.json(
            { ok: false, error: '缺少 raw、path 或 env 字段' },
            { status: 400 },
          )
        }

        writeConfig(config)

        // 写入后尝试热重载网关（离线/无重载端点时不影响保存结果）
        const reload = await tryReloadGateway()

        return Response.json({
          ok: true,
          message: '配置已保存。',
          ...(reload ? { reloadStatus: reload } : {}),
        })
      },
    },
  },
})
