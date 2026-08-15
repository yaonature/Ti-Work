/**
 * Config Get API — 读取当前 HERMES_HOME 下的 config.yaml 原始配置，
 * 并附带设置页需要的 API Key 快照，避免前端直接依赖服务端文件读取模块。
 */
import fs from 'node:fs'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import { requireAuth } from '../../server/auth-middleware'
import {
  getHermesConfigPath,
  getHermesEnvPath,
  readEnvValueWithFallback,
} from '../../server/env-models'

const CONFIG_PATH = getHermesConfigPath()
const ENV_PATH = getHermesEnvPath()
const MODEL_API_KEY_ENV_KEYS = [
  'DEEPSEEK_API_KEY',
  'DASHSCOPE_API_KEY',
  'OPENROUTER_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const

export const Route = createFileRoute('/api/config-get')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const guard = requireAuth(request)
        if (guard) return guard

        let payload: Record<string, unknown> = {}
        try {
          const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
          payload = (YAML.parse(raw) as Record<string, unknown>) || {}
        } catch {
          // 文件不存在或解析失败 → 返回空配置
        }

        const env: Record<string, string> = {}
        for (const key of MODEL_API_KEY_ENV_KEYS) {
          const value = readEnvValueWithFallback(key, ENV_PATH)
          if (value) env[key] = value
        }

        return Response.json({ ok: true, payload: { ...payload, __env: env } })
      },
    },
  },
})
