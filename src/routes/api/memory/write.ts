import fs from 'node:fs'
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { ensureGatewayProbed } from '../../../server/gateway-capabilities'
import { getMemoryWorkspaceRoot } from '../../../server/memory-browser'
import { requireJsonContentType } from '../../../server/rate-limit'

function validateMemoryWritePath(inputPath: unknown): {
  relativePath: string
  fullPath: string
} {
  if (typeof inputPath !== 'string') {
    throw new Error('路径必填')
  }

  const relativePath = inputPath.replace(/\\/g, '/').trim()
  if (!relativePath) throw new Error('路径必填')
  if (path.isAbsolute(relativePath))
    throw new Error('不允许使用绝对路径')
  if (relativePath.includes('..'))
    throw new Error('不允许路径穿越')
  if (!relativePath.toLowerCase().endsWith('.md'))
    throw new Error('仅允许 .md 文件')

  const workspaceRoot = getMemoryWorkspaceRoot()
  const fullPath = path.resolve(workspaceRoot, relativePath)
  const relativeFromRoot = path.relative(workspaceRoot, fullPath)
  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw new Error('解析后的路径超出工作区')
  }

  return { relativePath, fullPath }
}

export const Route = createFileRoute('/api/memory/write')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        await ensureGatewayProbed()
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: unknown
            content?: unknown
          }
          const { relativePath, fullPath } = validateMemoryWritePath(body.path)
          const content = typeof body.content === 'string' ? body.content : ''

          fs.mkdirSync(path.dirname(fullPath), { recursive: true })
          fs.writeFileSync(fullPath, content, 'utf-8')
          return json({ success: true, path: relativePath })
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : '写入记忆文件失败'
          const status =
            /必填|绝对路径|路径穿越|超出工作区|\.md/i.test(message)
              ? 400
              : 500
          return json({ error: message }, { status })
        }
      },
    },
  },
})
