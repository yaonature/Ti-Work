import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { ensureGatewayProbed } from '../../../server/gateway-capabilities'
import { listMemoryFiles } from '../../../server/memory-browser'

export const Route = createFileRoute('/api/memory/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        try {
          return json({ files: listMemoryFiles() })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : '列出记忆文件失败',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
