import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'

export const Route = createFileRoute('/api/skills/uninstall')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const body = (await request.json()) as { skillId?: string }
          const skillId = (body.skillId || '').trim()
          if (!skillId)
            return json(
              { ok: false, error: 'skillId 必填' },
              { status: 400 },
            )

          const skillsBase = path.join(os.homedir(), '.hermes', 'skills')
          const skillPath = path.join(skillsBase, skillId)

          // Path traversal guard — resolved path must be within skills dir
          if (!skillPath.startsWith(skillsBase + path.sep)) {
            return json(
              { ok: false, error: '无效的 skillId' },
              { status: 400 },
            )
          }

          if (!fs.existsSync(skillPath)) {
            return json(
              {
                ok: false,
                error: '未在 ~/.hermes/skills 下找到已安装的技能',
              },
              { status: 404 },
            )
          }
          fs.rmSync(skillPath, { recursive: true, force: false })
          return json({ ok: true, uninstalled: true, skillId })
        } catch (error) {
          return json(
            {
              ok: false,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to uninstall skill',
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
