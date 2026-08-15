/**
 * Connection status endpoint — returns a summary of portable chat readiness
 * plus whether Hermes gateway enhancements are available.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createFileRoute } from '@tanstack/react-router'
import YAML from 'yaml'
import {
  HERMES_API,
  ensureGatewayProbed,
  getChatMode,
} from '../../server/gateway-capabilities'
import { requireAuth } from '../../server/auth-middleware'

const CONFIG_PATH = path.join(os.homedir(), '.hermes', 'config.yaml')

function readActiveModel(): string {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const config = (YAML.parse(raw) as Record<string, unknown>) || {}
    const modelField = config.model
    if (typeof modelField === 'string') return modelField
    if (modelField && typeof modelField === 'object') {
      const obj = modelField as Record<string, unknown>
      return (obj.default as string) || ''
    }
  } catch {
    // config missing or unreadable
  }
  return ''
}

type ConnectionStatus = {
  status: 'connected' | 'enhanced' | 'partial' | 'disconnected'
  label: '已连接' | '增强模式' | '部分可用' | '未连接'
  detail: string
  health: boolean
  chatReady: boolean
  modelConfigured: boolean
  activeModel: string
  chatMode: 'enhanced-hermes' | 'portable' | 'disconnected'
  capabilities: Record<string, boolean>
  hermesUrl: string
}

export const Route = createFileRoute('/api/connection-status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authGuard = requireAuth(request)
        if (authGuard) return authGuard

        const caps = await ensureGatewayProbed()
        const activeModel = readActiveModel()
        const modelConfigured = Boolean(activeModel)

        const chatReady = caps.chatCompletions
        const enhancedReady =
          chatReady &&
          caps.sessions &&
          caps.skills &&
          caps.memory &&
          caps.config

        let status: ConnectionStatus['status']
        let label: ConnectionStatus['label']
        let detail: string

        if (!caps.health && !chatReady) {
          status = 'disconnected'
          label = '未连接'
          detail = '未检测到可用的兼容后端。'
        } else if (enhancedReady) {
          status = 'enhanced'
          label = '增强模式'
          detail = modelConfigured
            ? '核心会话可用，Hermes 网关 API 已就绪。'
            : 'Hermes 网关 API 已就绪。选择模型即可开始会话。'
        } else if (chatReady && modelConfigured) {
          status = 'connected'
          label = '已连接'
          detail = '此后端核心会话已就绪。'
        } else {
          status = 'partial'
          label = '部分可用'
          if (!chatReady) {
            detail = '后端可达，但会话 API 尚未就绪。'
          } else if (!modelConfigured) {
            detail = '后端已连接。请选择服务提供方和模型以测试会话。'
          } else {
            detail =
              '核心会话可用。增强的 Hermes 网关 API 为可选能力，可用时将自动解锁。'
          }
        }

        const body: ConnectionStatus = {
          status,
          label,
          detail,
          health: caps.health,
          chatReady,
          modelConfigured,
          activeModel,
          chatMode: getChatMode(),
          capabilities: {
            health: caps.health,
            chatCompletions: caps.chatCompletions,
            models: caps.models,
            streaming: caps.streaming,
            sessions: caps.sessions,
            skills: caps.skills,
            memory: caps.memory,
            config: caps.config,
            jobs: caps.jobs,
          },
          hermesUrl: HERMES_API,
        }

        return Response.json(body)
      },
    },
  },
})
