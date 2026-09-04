/**
 * Runs API proxy — forwards POST /v1/runs to Hermes gateway.
 * Returns { run_id, status: "started" } immediately (202).
 */
import { createFileRoute } from '@tanstack/react-router'
import { isAgentAccessDenied, requireAgentAccess } from '../../server/agent-unified-access'
import { gatewayFetch } from '../../server/agent-hub-client'

export const Route = createFileRoute('/api/hermes-runs')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = await requireAgentAccess(request, {
          capability: 'jobs',
          capabilityMessage: 'Runs API 不可用——网关未连接',
        })
        if (isAgentAccessDenied(access)) return access

        const body = await request.text()
        const res = await gatewayFetch('/v1/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        return new Response(await res.text(), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
