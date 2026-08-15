import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import {
  getActiveProfileName,
  listProfiles,
} from '../../../server/profiles-browser'

export const Route = createFileRoute('/api/profiles/list')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ error: 'Unauthorized' }, { status: 401 })
        }
        try {
          return json({
            profiles: listProfiles(),
            activeProfile: getActiveProfileName(),
          })
        } catch (error) {
          return json(
            {
              error:
                error instanceof Error
                  ? error.message
                  : '列出档案失败',
              profiles: [],
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
