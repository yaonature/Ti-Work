/**
 * 从 ~/.hermes/.env 读取已配置 Key 的 API Key 型服务商，返回其兜底模型列表。
 * 网关不可达或 /v1/models 未列出时，只要 env 里配了对应 Key，
 * 模型选择器也能看到可用模型，避免"配置了 Key 却没有任何模型"。
 * 服务商清单与 hermes-config.ts 的 PROVIDERS envKeys 保持一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export type EnvModelEntry = {
  id: string
  name: string
  provider: string
}

export const ENV_PROVIDER_MODELS: Array<{
  id: string
  envKey: string
  models: Array<EnvModelEntry>
}> = [
  {
    id: 'deepseek',
    envKey: 'DEEPSEEK_API_KEY',
    models: [
      { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek' },
      { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek' },
    ],
  },
  {
    id: 'dashscope',
    envKey: 'DASHSCOPE_API_KEY',
    models: [
      { id: 'qwen-max', name: '通义千问 Max', provider: 'dashscope' },
      { id: 'qwen-plus', name: '通义千问 Plus', provider: 'dashscope' },
      { id: 'qwen3', name: '通义千问 Qwen3', provider: 'dashscope' },
    ],
  },
  {
    id: 'openrouter',
    envKey: 'OPENROUTER_API_KEY',
    models: [
      { id: 'openrouter/auto', name: 'OpenRouter Auto', provider: 'openrouter' },
    ],
  },
  {
    id: 'anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', provider: 'anthropic' },
    ],
  },
  {
    id: 'zai',
    envKey: 'GLM_API_KEY',
    models: [{ id: 'glm-4-plus', name: 'GLM-4-Plus', provider: 'zai' }],
  },
  {
    id: 'kimi',
    envKey: 'KIMI_API_KEY',
    models: [{ id: 'kimi-latest', name: 'Kimi 最新版', provider: 'kimi-coding' }],
  },
  {
    id: 'minimax',
    envKey: 'MINIMAX_API_KEY',
    models: [{ id: 'MiniMax-M2.5', name: 'MiniMax M2.5', provider: 'minimax' }],
  },
]

function resolveUserHome(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.USERPROFILE?.trim() || env.HOME?.trim() || os.homedir()
}

export function getHermesHome(
  env: Record<string, string | undefined> = process.env,
): string {
  const fromEnv = env.HERMES_HOME?.trim()
  if (fromEnv) return fromEnv
  if (process.platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim()
    if (localAppData) return path.join(localAppData, 'Ti Work', 'Hermes')
  }
  return path.join(resolveUserHome(env), '.ti-work', 'hermes')
}

export function getHermesEnvPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return path.join(getHermesHome(env), '.env')
}

export function getHermesConfigPath(
  env: Record<string, string | undefined> = process.env,
): string {
  return path.join(getHermesHome(env), 'config.yaml')
}

export function getLegacyHermesEnvPaths(
  env: Record<string, string | undefined> = process.env,
): Array<string> {
  return [
    path.join(resolveUserHome(env), '.hermes', '.env'),
  ]
}

export function readEnvValue(envPath: string, envKey: string): string {
  try {
    if (!fs.existsSync(envPath)) return ''
    const content = fs.readFileSync(envPath, 'utf-8')
    const line = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.startsWith(`${envKey}=`))
    if (!line) return ''
    const value = line.slice(envKey.length + 1).trim()
    // strip optional surrounding quotes
    return value.replace(/^["']|["']$/g, '').trim()
  } catch {
    return ''
  }
}

export function readEnvValueWithFallback(
  envKey: string,
  envPath = getHermesEnvPath(),
  env: Record<string, string | undefined> = process.env,
): string {
  const primary = readEnvValue(envPath, envKey)
  if (primary) return primary
  for (const legacyPath of getLegacyHermesEnvPaths(env)) {
    const legacy = readEnvValue(legacyPath, envKey)
    if (legacy) return legacy
  }
  return ''
}

/** 写入 ~/.hermes/.env 键值（保留其余行；企业统一下发 Key 时使用） */
export function writeEnvValue(envPath: string, envKey: string, value: string): void {
  try {
    const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : ''
    const lines = content.split(/\r?\n/)
    const index = lines.findIndex((l) => l.trim().startsWith(`${envKey}=`))
    const entry = `${envKey}=${value.includes(' ') || value.includes('#') ? `"${value}"` : value}`
    if (index >= 0) {
      lines[index] = entry
    } else {
      lines.push(entry)
    }
    fs.mkdirSync(path.dirname(envPath), { recursive: true })
    fs.writeFileSync(envPath, lines.join('\n'), 'utf-8')
  } catch {
    // 写入失败不阻塞登录（本地功能不受影响）
  }
}

/** 读取 ~/.hermes/.env 中已配置 Key 的服务商，返回对应兜底模型。 */
export function getEnvConfiguredModels(): Array<EnvModelEntry> {
  const envPath = getHermesEnvPath()
  const extra: Array<EnvModelEntry> = []
  for (const provider of ENV_PROVIDER_MODELS) {
    if (readEnvValueWithFallback(provider.envKey, envPath)) {
      extra.push(...provider.models)
    }
  }
  return extra
}
