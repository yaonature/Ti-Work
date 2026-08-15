import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { ensureGatewayProbed } from '../../../server/gateway-capabilities'
import { readMemoryFile } from '../../../server/memory-browser'

export const Route = createFileRoute('/api/memory/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        const url = new URL(request.url)
        const pathParam = url.searchParams.get('path') || ''
        try {
          const content = readMemoryFile(pathParam)
          return json({ path: pathParam, content })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : '读取记忆文件失败'
          const status = /不允许|超出工作区|必填/i.test(message)
            ? 400
            : /ENOENT/.test(message)
              ? 404
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
