import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getUserIdFromRequest,
  isAuthenticated,
  isPasswordProtectionEnabled,
} from '../../server/auth-middleware'
import {
  getPublicUser,
  isMultiUserEnabled,
  isSelfRegisterEnabled,
} from '../../server/identity'
import { ensureGatewayProbed } from '../../server/gateway-capabilities'

export const Route = createFileRoute('/api/auth-check')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const multiUser = isMultiUserEnabled()
        // 多用户模式下必须登录（无外部可绕过路径）；单用户模式沿用原单密码开关
        const authRequired = multiUser || isPasswordProtectionEnabled()
        const authenticated = isAuthenticated(request)
        const currentUser = (() => {
          if (!multiUser || !authenticated) return null
          const userId = getUserIdFromRequest(request)
          if (!userId) return null
          const user = getPublicUser(userId)
          if (!user) return null
          return {
            userId: user.userId,
            displayName: user.displayName,
            role: user.role,
          }
        })()

        let gatewayAvailable = false
        let gatewayError: string | undefined
        try {
          const caps = await ensureGatewayProbed()
          gatewayAvailable = Boolean(caps.health || caps.chatCompletions || caps.models)
          if (!gatewayAvailable) gatewayError = 'hermes_agent_unreachable'
        } catch (error) {
          gatewayError =
            error instanceof DOMException && error.name === 'AbortError'
              ? 'hermes_agent_timeout'
              : 'hermes_agent_unreachable'
        }

        return json({
          authenticated,
          authRequired,
          multiUser,
          selfRegister: isSelfRegisterEnabled(),
          currentUser,
          gatewayAvailable,
          error: gatewayError,
        })
      },
    },
  },
})
