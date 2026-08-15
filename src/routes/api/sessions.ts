import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  getEffectiveSessionOwner,
  isAuthenticated,
} from '../../server/auth-middleware'
import { requireJsonContentType } from '../../server/rate-limit'
import {
  createSession,
  deleteSession,
  ensureGatewayProbed,
  getGatewayCapabilities,
  listSessions,
  toSessionSummary,
  updateSession,
} from '../../server/hermes-api'
import type { HermesSession } from '../../server/hermes-api'
import {
  canAccessLocalSession,
  deleteLocalSession,
  ensureLocalSession,
  listLocalSessions,
  toLocalSessionSummary,
  updateLocalSessionTitle,
} from '../../server/local-session-store'
import { createCapabilityUnavailablePayload } from '@/lib/feature-gates'

export const Route = createFileRoute('/api/sessions')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Auth check
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          const ownerId = getEffectiveSessionOwner(request)
          const localSessions = listLocalSessions(ownerId)
          return json({
            ok: true,
            sessions: localSessions.map(toLocalSessionSummary),
            source: 'local',
          })
        }

        try {
          const raw = (await listSessions(50, 0)) as unknown
          // Handle OpenAI-format response: { object: "list", data: [...] }
          const sessionList = Array.isArray(raw)
            ? (raw as Array<HermesSession>)
            : ((raw as { data?: Array<HermesSession> })?.data ?? [])
          return json({ ok: true, sessions: sessionList.map(toSessionSummary), source: 'gateway' })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheckPost = requireJsonContentType(request)
        if (csrfCheckPost) return csrfCheckPost
        await ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          const body2 = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const requestedId =
            typeof body2.friendlyId === 'string' ? body2.friendlyId.trim() : ''
          const model =
            typeof body2.model === 'string' ? body2.model.trim() : undefined
          const friendlyId = requestedId || randomUUID()
          const ownerId = getEffectiveSessionOwner(request)
          const session = ensureLocalSession(friendlyId, model, ownerId)
          return json({
            ok: true,
            sessionKey: session.id,
            friendlyId: session.id,
            entry: toLocalSessionSummary(session),
            persisted: true,
            source: 'local',
          })
        }
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const requestedLabel =
            typeof body.label === 'string' ? body.label.trim() : ''
          const label = requestedLabel || undefined

          const requestedFriendlyId =
            typeof body.friendlyId === 'string' ? body.friendlyId.trim() : ''
          const friendlyId = requestedFriendlyId || randomUUID()

          const requestedModel =
            typeof body.model === 'string' ? body.model.trim() : ''
          const model = requestedModel || undefined
          const session = await createSession({
            id: friendlyId || randomUUID(),
            title: label,
            model,
          })

          return json({
            ok: true,
            sessionKey: session.id,
            friendlyId: session.id,
            entry: toSessionSummary(session),
            modelApplied: true,
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const csrfCheckPatch = requireJsonContentType(request)
        if (csrfCheckPatch) return csrfCheckPatch
        await ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const rawSessionKey =
            typeof body.sessionKey === 'string' ? body.sessionKey.trim() : ''
          const rawFriendlyId =
            typeof body.friendlyId === 'string' ? body.friendlyId.trim() : ''
          const sessionKey = rawSessionKey || rawFriendlyId
          const label =
            typeof body.label === 'string' ? body.label.trim() : undefined
          const ownerId = getEffectiveSessionOwner(request)
          if (sessionKey && label) {
            if (!canAccessLocalSession(sessionKey, ownerId)) {
              return json(
                { ok: false, error: 'Forbidden' },
                { status: 403 },
              )
            }
            updateLocalSessionTitle(sessionKey, label)
          }
          return json({
            ok: true,
            sessionKey: sessionKey || rawFriendlyId,
            friendlyId: rawFriendlyId || sessionKey,
            updated: !!label,
            source: 'local',
          })
        }
        try {
          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >

          const rawSessionKey =
            typeof body.sessionKey === 'string' ? body.sessionKey.trim() : ''
          const rawFriendlyId =
            typeof body.friendlyId === 'string' ? body.friendlyId.trim() : ''
          const label =
            typeof body.label === 'string' ? body.label.trim() : undefined
          const sessionKey = rawSessionKey || rawFriendlyId

          if (!sessionKey) {
            return json(
              { ok: false, error: 'sessionKey 必填' },
              { status: 400 },
            )
          }

          const session = await updateSession(sessionKey, {
            title: label,
          })

          return json({
            ok: true,
            sessionKey,
            entry: toSessionSummary(session),
          })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
      DELETE: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        await ensureGatewayProbed()
        if (!getGatewayCapabilities().sessions) {
          const url = new URL(request.url)
          const rawSessionKey = url.searchParams.get('sessionKey') ?? ''
          const rawFriendlyId = url.searchParams.get('friendlyId') ?? ''
          const sessionKey = rawSessionKey.trim() || rawFriendlyId.trim()
          if (sessionKey) {
            if (!canAccessLocalSession(sessionKey, getEffectiveSessionOwner(request))) {
              return json(
                { ok: false, error: 'Forbidden' },
                { status: 403 },
              )
            }
            deleteLocalSession(sessionKey)
          }
          return json({
            ok: true,
            sessionKey,
            deleted: !!sessionKey,
            source: 'local',
          })
        }
        try {
          const url = new URL(request.url)
          const rawSessionKey = url.searchParams.get('sessionKey') ?? ''
          const rawFriendlyId = url.searchParams.get('friendlyId') ?? ''
          const sessionKey = rawSessionKey.trim() || rawFriendlyId.trim()

          if (!sessionKey) {
            return json(
              { ok: false, error: 'sessionKey 必填' },
              { status: 400 },
            )
          }

          await deleteSession(sessionKey)

          return json({ ok: true, sessionKey })
        } catch (err) {
          return json(
            {
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            },
            { status: 500 },
          )
        }
      },
    },
  },
})
