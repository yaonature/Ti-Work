/**
 * GET  /api/crews/templates  — list all templates (built-in + user)
 * POST /api/crews/templates  — create a user template
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'
import { requireJsonContentType } from '../../../../server/rate-limit'
import {
  createUserTemplate,
  listTemplates,
} from '../../../../server/template-store'
import type { CrewTemplateCategory } from '../../../../types/template'

const VALID_CATEGORIES: Array<CrewTemplateCategory> = [
  'research',
  'engineering',
  'creative',
  'operations',
]

const VALID_ROLES = ['coordinator', 'executor', 'reviewer', 'specialist'] as const

export const Route = createFileRoute('/api/crews/templates/')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        return json({ ok: true, templates: listTemplates() })
      },

      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck

        const body = (await request.json().catch(() => ({}))) as Record<
          string,
          unknown
        >

        const name =
          typeof body.name === 'string' ? body.name.trim() : ''
        if (!name) {
          return json(
            { ok: false, error: '名称必填' },
            { status: 400 },
          )
        }

        const category = body.category as string
        if (!VALID_CATEGORIES.includes(category as CrewTemplateCategory)) {
          return json(
            { ok: false, error: '无效的分类' },
            { status: 400 },
          )
        }

        if (!Array.isArray(body.defaultMembers) || body.defaultMembers.length === 0) {
          return json(
            { ok: false, error: 'defaultMembers 必须是非空数组' },
            { status: 400 },
          )
        }

        const defaultMembers: Array<{ persona: string; role: typeof VALID_ROLES[number] }> = []
        for (const m of body.defaultMembers as Array<unknown>) {
          if (
            typeof m !== 'object' ||
            m === null ||
            typeof (m as Record<string, unknown>).persona !== 'string' ||
            !VALID_ROLES.includes((m as Record<string, unknown>).role as typeof VALID_ROLES[number])
          ) {
            return json(
              { ok: false, error: '每个成员必须包含 persona（字符串）和有效的角色' },
              { status: 400 },
            )
          }
          defaultMembers.push({
            persona: ((m as Record<string, unknown>).persona as string).toLowerCase(),
            role: (m as Record<string, unknown>).role as typeof VALID_ROLES[number],
          })
        }

        const template = createUserTemplate({
          name,
          description: typeof body.description === 'string' ? body.description.trim() : '',
          icon: typeof body.icon === 'string' ? body.icon : '🤖',
          category: category as CrewTemplateCategory,
          defaultGoal: typeof body.defaultGoal === 'string' ? body.defaultGoal.trim() : '',
          defaultMembers,
          tags: Array.isArray(body.tags)
            ? (body.tags as Array<unknown>).filter((t): t is string => typeof t === 'string')
            : [],
        })

        return json({ ok: true, template }, { status: 201 })
      },
    },
  },
})
