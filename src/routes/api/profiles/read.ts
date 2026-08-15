import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { readProfile } from '../../../server/profiles-browser'

export const Route = createFileRoute('/api/profiles/read')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const name = (url.searchParams.get('name') || '').trim() || 'default'
          return json({ profile: readProfile(name) })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : '读取档案失败',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
