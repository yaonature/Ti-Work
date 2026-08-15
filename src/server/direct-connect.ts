/**
 * 直连降级（Direct Connect）——网关离线时的兜底通道。
 *
 * 背景：Hermes 执行引擎网关（127.0.0.1:8642）离线时，所有经网关的聊天请求
 * 都会失败（"有模型可发不出消息"）。本模块为已配置 API Key 的 OpenAI 兼容
 * 服务商提供直连端点解析，send-stream 的 portable 分支在网关离线时降级直连。
 *
 * 直连只兜底"纯对话补全"（/v1/chat/completions），不含 Agent 工具链/记忆/
 * 技能等网关增强能力——这是引擎内置（批次 1）之前的临时兜底。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readEnvValue, getHermesEnvPath } from './env-models'

export type DirectConnectTarget = {
  providerId: string
  baseUrl: string
  apiKey: string
  /** 直连时使用的模型 id（去掉 provider 前缀后的纯 id） */
  modelId: string
}

/**
 * 已内置直连端点的 OpenAI 兼容服务商（baseUrl 为 /v1 级）。
 * 与 hermes-config.ts 的 PROVIDERS / env-models.ts 的 ENV_PROVIDER_MODELS
 * 保持 id 一致。
 */
const DIRECT_CONNECT_PROVIDERS: Record<
  string,
  { label: string; baseUrl: string; envKey: string }
> = {
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    envKey: 'DEEPSEEK_API_KEY',
  },
  dashscope: {
    label: '通义千问 Qwen（阿里云百炼）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
  },
  zai: {
    label: 'Z.AI / GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    envKey: 'GLM_API_KEY',
  },
  'kimi-coding': {
    label: 'Kimi / Moonshot',
    baseUrl: 'https://api.moonshot.cn/v1',
    envKey: 'KIMI_API_KEY',
  },
  minimax: {
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    envKey: 'MINIMAX_API_KEY',
  },
}

/** 供应商 id 归一化（litellm 标准 id → 直连表 id） */
function normalizeProviderId(providerId: string): string {
  const id = providerId.trim().toLowerCase()
  if (id === 'kimi' || id === 'moonshot') return 'kimi-coding'
  if (id === 'zai' || id === 'glm' || id === 'bigmodel') return 'zai'
  if (id === 'qwen' || id === 'aliyun') return 'dashscope'
  return id
}

/** 从模型 id 中拆出 provider 前缀（如 deepseek:deepseek-chat / openrouter/auto） */
function splitModelId(model: string): {
  provider: string
  modelId: string
} {
  const trimmed = model.trim()
  if (trimmed.includes(':')) {
    const [provider, modelId] = trimmed.split(':')
    return { provider: provider.trim(), modelId: modelId.trim() }
  }
  if (trimmed.includes('/') && !trimmed.startsWith('http')) {
    const parts = trimmed.split('/')
    // openrouter/auto 这类 "provider/model" 形态
    if (parts.length === 2) {
      return { provider: parts[0].trim(), modelId: parts[1].trim() }
    }
  }
  return { provider: '', modelId: trimmed }
}

/**
 * 尝试为给定模型解析直连目标。
 * 匹配顺序：模型内嵌 provider 前缀 → 显式 provider 参数 → 读取
 * ~/.hermes/config.yaml 当前 provider。任一匹配且 env 中有 Key 即可直连。
 * 返回 null 表示无法直连（未配置 Key / 服务商不支持 / 模型为空）。
 */
export function resolveDirectConnectTarget(
  model: string | undefined,
  provider?: string,
): DirectConnectTarget | null {
  const rawModel = (model ?? '').trim()
  const { provider: providerFromModel, modelId } = splitModelId(rawModel)

  const candidates: Array<{ provider: string; model: string }> = []
  if (providerFromModel) {
    candidates.push({ provider: providerFromModel, model: modelId || rawModel })
  }
  if (provider?.trim()) {
    candidates.push({
      provider: provider.trim(),
      model: rawModel || modelId || '',
    })
  }
  if (candidates.length === 0 || !rawModel) {
    // 未显式给模型：读取 config.yaml 当前模型
    const active = readActiveModelFromConfig()
    if (active) {
      candidates.unshift(active)
    }
  }

  for (const candidate of candidates) {
    const target = tryBuild(candidate.provider, candidate.model || rawModel)
    if (target) return target
  }
  return null
}

function tryBuild(provider: string, model: string): DirectConnectTarget | null {
  const normalized = normalizeProviderId(provider)
  const entry = DIRECT_CONNECT_PROVIDERS[normalized]
  if (!entry) return null
  const apiKey = readEnvValue(getHermesEnvPath(), entry.envKey)
  if (!apiKey) return null
  const pureModelId = splitModelId(model).modelId || model.trim()
  if (!pureModelId) return null
  return {
    providerId: normalized,
    baseUrl: entry.baseUrl,
    apiKey,
    modelId: pureModelId,
  }
}

type HermesConfig = {
  model?: string | { default?: string; provider?: string }
  provider?: string
}

function readActiveModelFromConfig(): { provider: string; model: string } | null {
  try {
    const configPath = path.join(os.homedir(), '.hermes', 'config.yaml')
    if (!fs.existsSync(configPath)) return null
    const raw = fs.readFileSync(configPath, 'utf-8')
    // 轻量解析：只取 model / provider 顶层键（config.yaml 为 YAML，顶层标量可直接提取）
    const config = parseTopLevelScalars(raw)
    const modelField = config.model
    let model = ''
    let provider = ''
    if (typeof modelField === 'string') {
      model = modelField
      provider =
        typeof config.provider === 'string' ? config.provider : ''
    } else if (modelField && typeof modelField === 'object') {
      const modelObj = modelField as Record<string, string>
      model = modelObj.default ?? ''
      provider =
        modelObj.provider ??
        (typeof config.provider === 'string' ? config.provider : '')
    }
    if (!model) return null
    return { provider: provider || splitModelId(model).provider, model }
  } catch {
    return null
  }
}

/** 顶层 YAML 标量解析（避免为读两个键引入 yaml 依赖） */
function parseTopLevelScalars(raw: string): Record<string, string | object> {
  const result: Record<string, string | object> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || /^[-{[]/.test(trimmed)) continue
    const eqIdx = trimmed.indexOf(':')
    if (eqIdx <= 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if (!value) continue
    if (value.startsWith('{') && value.endsWith('}')) {
      // model: { default: "...", provider: "..." } 内联对象
      const obj: Record<string, string> = {}
      for (const part of value.slice(1, -1).split(',')) {
        const innerEq = part.indexOf(':')
        if (innerEq <= 0) continue
        obj[part.slice(0, innerEq).trim()] = part
          .slice(innerEq + 1)
          .trim()
          .replace(/^["']|["']$/g, '')
      }
      result[key] = obj
    } else {
      result[key] = value.replace(/^["']|["']$/g, '')
    }
  }
  return result
}
