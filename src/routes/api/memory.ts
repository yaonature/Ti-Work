import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireLocalOrAuth } from '../../server/auth-middleware'
import {
  HERMES_API,
  ensureGatewayProbed,
  getCapabilities,
} from '../../server/gateway-capabilities'
import { getMemory } from '../../server/hermes-api'

export const Route = createFileRoute('/api/memory')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!requireLocalOrAuth(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        await ensureGatewayProbed()
        if (!getCapabilities().memory) {
          return json(
            {
              ok: false,
              error: `网关不支持 ${HERMES_API} 上的 /api/memory`,
            },
            { status: 503 },
          )
        }

        try {
          return json(await getMemory())
        } catch (err) {
          return json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 },
          )
        }
      },
    },
  },
})
