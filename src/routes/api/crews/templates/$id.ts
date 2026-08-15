/**
 * DELETE /api/crews/templates/:id — delete a user template (built-ins protected)
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'
import { deleteUserTemplate, getTemplate } from '../../../../server/template-store'

export const Route = createFileRoute('/api/crews/templates/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const template = getTemplate(params.id)
        if (!template) {
          return json({ ok: false, error: '未找到该模板' }, { status: 404 })
        }
        if (template.isBuiltIn) {
          return json(
            { ok: false, error: '内置模板不可删除' },
            { status: 403 },
          )
        }
        deleteUserTemplate(params.id)
        return json({ ok: true })
      },
    },
  },
})
