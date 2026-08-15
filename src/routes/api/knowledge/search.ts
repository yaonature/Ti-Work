import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { searchKnowledgePages } from '../../../server/knowledge-browser'

export const Route = createFileRoute('/api/knowledge/search')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const query = url.searchParams.get('q') || ''

        try {
          return json({ results: searchKnowledgePages(query) })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : '搜索知识库页面失败',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
