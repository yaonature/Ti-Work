import { createFileRoute } from '@tanstack/react-router'
import { requireLocalOrAuth } from '../../server/auth-middleware'
import { createTerminalSession } from '../../server/terminal-sessions'
import {
  AuthorizationGuardError,
  enforceTerminalAccess,
  readDesktopSecurityPolicy,
} from '../../server/authorization-guard'
import {
  consumeRiskApprovalGrant,
  createRiskApprovalRequest,
} from '../../server/risk-approval'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
} from '../../server/rate-limit'

export const Route = createFileRoute('/api/terminal-stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!requireLocalOrAuth(request)) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Unauthorized' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
        const csrfCheck = requireJsonContentType(request)
        if (csrfCheck) return csrfCheck
        const ip = getClientIp(request)
        if (!rateLimit(`terminal-stream:${ip}`, 10, 60_000)) {
          return rateLimitResponse()
        }

        const body = (await request.json().catch(() => ({}))) as Record<
          string,
          unknown
        >
        const cwd =
          typeof body.cwd === 'string' && body.cwd.trim().length > 0
            ? body.cwd.trim()
            : undefined
        const cols =
          typeof body.cols === 'number'
            ? Math.max(20, Math.min(500, Math.floor(body.cols)))
            : undefined
        const rows =
          typeof body.rows === 'number'
            ? Math.max(5, Math.min(300, Math.floor(body.rows)))
            : undefined
        const command = Array.isArray(body.command)
          ? body.command.slice(0, 32).map((part) => String(part).slice(0, 2000))
          : undefined
        const riskApprovalToken =
          typeof body.riskApprovalToken === 'string' &&
          body.riskApprovalToken.trim()
            ? body.riskApprovalToken.trim()
            : undefined

        // ── 高风险动作门禁（终端打开 = execute_shell）──────────────────────────
        // 命中「需要确认 / 需要审批」时：
        //   - 未携带放行凭据 → 创建待审批请求并以 JSON 返回，前端据此展示确认面板；
        //   - 携带放行凭据 → 校验通过则继续创建会话，否则拒绝（防重放/过期）。
        const terminalSubject = `打开终端（${cwd ?? '默认目录'}）`
        try {
          enforceTerminalAccess({
            action: 'execute_shell',
            command: terminalSubject,
            profileName: null,
          })
        } catch (error) {
          if (
            error instanceof AuthorizationGuardError &&
            (error.code === 'terminal_requires_confirmation' ||
              error.code === 'terminal_requires_approval')
          ) {
            if (riskApprovalToken) {
              const grantOk = consumeRiskApprovalGrant(
                riskApprovalToken,
                'execute_shell',
              )
              if (grantOk) {
                // 凭据有效：放行，继续创建会话
              } else {
                return Response.json(
                  {
                    ok: false,
                    error: '审批凭据无效或已过期，请重新发起终端操作。',
                    code: 'risk_grant_invalid',
                  },
                  { status: 403 },
                )
              }
            } else {
              const policy = readDesktopSecurityPolicy()
              const riskRequest = createRiskApprovalRequest({
                action: 'execute_shell',
                subject: terminalSubject,
                decision:
                  error.code === 'terminal_requires_approval'
                    ? 'needs_approval'
                    : 'needs_confirmation',
                profileName: null,
                ttlMs: Math.max(15_000, policy.approvals.timeout * 1000),
              })
              return Response.json(
                {
                  ok: false,
                  code: error.code,
                  requestId: riskRequest.id,
                  action: 'execute_shell',
                  subject: riskRequest.subject,
                  decision: riskRequest.decision,
                },
                { status: 403 },
              )
            }
          } else {
            return Response.json(
              { ok: false, error: '终端操作被安全策略拦截。' },
              { status: 403 },
            )
          }
        }

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            let isStreamActive = true

            const send = (event: string, data: unknown) => {
              if (!isStreamActive || controller.desiredSize === null) return
              try {
                controller.enqueue(
                  encoder.encode(
                    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
                  ),
                )
              } catch {
                isStreamActive = false
              }
            }

            let session: ReturnType<typeof createTerminalSession>

            try {
              session = createTerminalSession({
                command,
                cwd,
                cols,
                rows,
              })
            } catch (error) {
              if (import.meta.env.DEV)
                console.error(
                  '[terminal-stream] Failed to create session:',
                  error,
                )
              send('error', { message: String(error) })
              try {
                controller.close()
              } catch {
                /* */
              }
              return
            }

            send('session', { sessionId: session.id })

            const handleEvent = (evt: { event: string; payload: unknown }) => {
              if (evt.event === 'data') {
                send('data', evt.payload)
              } else if (evt.event === 'exit') {
                send('exit', evt.payload)
              }
            }

            const handleClose = () => {
              send('close', { sessionId: session.id })
              if (!isStreamActive) return
              isStreamActive = false
              try {
                controller.close()
              } catch {
                /* */
              }
            }

            session.emitter.on('event', handleEvent)
            session.emitter.on('close', handleClose)

            const keepAlive = setInterval(() => {
              send('ping', { t: Date.now() })
            }, 8000)

            const abort = () => {
              isStreamActive = false
              clearInterval(keepAlive)
              session.emitter.off('event', handleEvent)
              session.emitter.off('close', handleClose)
              session.close()
            }

            request.signal.addEventListener('abort', abort)
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
