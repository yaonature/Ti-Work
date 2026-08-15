export type ProviderAuthType = 'api-key' | 'oauth' | 'local' | 'cli-token'

export type ProviderInfo = {
  id: string
  name: string
  description: string
  authTypes: Array<ProviderAuthType>
  docsUrl: string
  configExample: string
}

export const HERMES_CONFIG_PATH = '~/.hermes/config.yaml'

export const PROVIDER_CATALOG: Array<ProviderInfo> = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 模型系列，包括 Haiku、Sonnet 和 Opus。',
    authTypes: ['api-key', 'cli-token'],
    docsUrl: 'https://console.anthropic.com/settings/keys',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'anthropic:default': {
              provider: 'anthropic',
              apiKey: 'sk-your-key-here',
              model: 'deepseek-v4-flash',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: '适用于会话与工具调用的 GPT 与推理模型。',
    authTypes: ['api-key'],
    docsUrl: 'https://platform.openai.com/api-keys',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'openai:default': {
              provider: 'openai',
              apiKey: 'sk-your-key-here',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'google',
    name: 'Google',
    description: '支持 API Key 或 OAuth 的 Gemini 模型。',
    authTypes: ['api-key', 'oauth'],
    docsUrl: 'https://aistudio.google.com/app/apikey',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'google:default': {
              provider: 'google',
              apiKey: 'sk-your-key-here',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'deepseek',
    name: 'DeepSeek（深度求索）',
    description: '国内大模型：DeepSeek V4 Flash / Pro 系列，中文与办公场景能力强。',
    authTypes: ['api-key'],
    docsUrl: 'https://platform.deepseek.com/api_keys',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'deepseek:default': {
              provider: 'deepseek',
              baseUrl: 'https://api.deepseek.com/v1',
              apiKey: 'sk-your-key-here',
              model: 'deepseek-v4-flash',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'dashscope',
    name: '通义千问 Qwen（阿里云百炼）',
    description: '阿里云百炼通义千问 Qwen 系列：qwen-max / qwen-plus 等，OpenAI 兼容接口。',
    authTypes: ['api-key'],
    docsUrl: 'https://bailian.console.aliyun.com/',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'dashscope:default': {
              provider: 'dashscope',
              baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
              apiKey: 'sk-your-key-here',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '通过一个 API 统一接入多个模型提供方。',
    authTypes: ['api-key'],
    docsUrl: 'https://openrouter.ai/keys',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'openrouter:default': {
              provider: 'openrouter',
              apiKey: 'sk-your-key-here',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    description: 'MiniMax 基础模型与多模态 API。',
    authTypes: ['api-key'],
    docsUrl: 'https://www.minimax.io/platform',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'minimax:default': {
              provider: 'minimax',
              apiKey: 'sk-your-key-here',
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    id: 'ollama',
    name: 'Ollama',
    description: '通过 Ollama 在本机运行的本地模型。',
    authTypes: ['local'],
    docsUrl: 'https://ollama.com/download',
    configExample: JSON.stringify(
      {
        auth: {
          profiles: {
            'ollama:local': {
              provider: 'ollama',
            },
          },
        },
      },
      null,
      2,
    ),
  },
]

export function normalizeProviderId(value: string): string {
  return value.trim().toLowerCase()
}

export function getProviderInfo(providerId: string): ProviderInfo | null {
  const normalized = normalizeProviderId(providerId)
  for (const provider of PROVIDER_CATALOG) {
    if (provider.id === normalized) return provider
  }
  return null
}

export function getProviderDisplayName(providerId: string): string {
  const provider = getProviderInfo(providerId)
  if (provider) return provider.name

  const normalized = normalizeProviderId(providerId)
  if (!normalized) return '未知提供方'

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(function mapChunk(chunk) {
      return chunk.slice(0, 1).toUpperCase() + chunk.slice(1)
    })
    .join(' ')
}

export function getAuthTypeLabel(authType: ProviderAuthType): string {
  if (authType === 'api-key') return 'API Key'
  if (authType === 'oauth') return 'OAuth'
  if (authType === 'cli-token') return 'CLI 令牌'
  return '本地'
}

export function buildConfigExample(
  provider: ProviderInfo,
  authType: ProviderAuthType,
): string {
  const profileKey =
    authType === 'local' ? `${provider.id}:local` : `${provider.id}:default`

  if (authType === 'oauth') {
    return JSON.stringify(
      {
        auth: {
          profiles: {
            [profileKey]: {
              provider: provider.id,
              oauth: {
                enabled: true,
              },
            },
          },
        },
      },
      null,
      2,
    )
  }

  if (authType === 'local') {
    return JSON.stringify(
      {
        auth: {
          profiles: {
            [profileKey]: {
              provider: provider.id,
            },
          },
        },
      },
      null,
      2,
    )
  }

  return provider.configExample
}
