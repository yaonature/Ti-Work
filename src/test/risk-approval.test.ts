import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {RiskApprovalRequest} from '@/server/risk-approval';
import {
  
  clearRiskApprovalRequests,
  consumeRiskApprovalGrant,
  createRiskApprovalRequest,
  getRiskApprovalRequest,
  resolveRiskApproval
} from '@/server/risk-approval'
import { configureHabitProfile } from '@/server/habit-profile'

const publishChatEvent = vi.fn()

vi.mock('@/server/chat-event-bus', () => ({
  publishChatEvent: (...args: Array<unknown>) => publishChatEvent(...args),
}))

let habitTempDir: string
let configTempDir: string

beforeEach(() => {
  publishChatEvent.mockClear()
  clearRiskApprovalRequests()
  // 审计/画像落盘走临时目录，避免污染真实 ~/.hermes
  habitTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'risk-approval-habits-'))
  configureHabitProfile({ storeDir: habitTempDir })
  // 审批「始终允许」写回的目标 config.yaml 指向临时目录
  configTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'risk-approval-config-'))
  vi.stubEnv('HERMES_HOME', configTempDir)
})

afterEach(() => {
  clearRiskApprovalRequests()
  vi.unstubAllEnvs()
  fs.rmSync(habitTempDir, { recursive: true, force: true })
  fs.rmSync(configTempDir, { recursive: true, force: true })
})

describe('risk-approval', () => {
  it('创建一条待确认请求（pending，带 TTL）', () => {
    const request = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端（~/.hermes）',
      decision: 'needs_confirmation',
    })

    expect(request.id).toBeTruthy()
    expect(request.action).toBe('execute_shell')
    expect(request.subject).toBe('打开终端（~/.hermes）')
    expect(request.decision).toBe('needs_confirmation')
    expect(request.status).toBe('pending')
    expect(request.scope).toBeNull()
    expect(request.usedCount).toBe(0)
    expect(request.expiresAt - request.createdAt).toBe(60_000)
  })

  it('TTL 下限兜底为 15 秒', () => {
    const request = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
      ttlMs: 1,
    })

    expect(request.expiresAt - request.createdAt).toBe(15_000)
  })

  it('未过期时可读取待审批请求', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })

    const fetched = getRiskApprovalRequest(created.id)
    expect(fetched).toBeDefined()
    expect(fetched?.status).toBe('pending')
  })

  it('过期后请求失效并从存储移除', () => {
    vi.useFakeTimers()
    try {
      const created = createRiskApprovalRequest({
        action: 'execute_shell',
        subject: '打开终端',
        decision: 'needs_approval',
        ttlMs: 15_000,
      })

      vi.advanceTimersByTime(15_001)
      // 首次读取返回已标记过期的请求，且已从存储移除
      const expired = getRiskApprovalRequest(created.id)
      expect(expired?.status).toBe('expired')
      expect(getRiskApprovalRequest(created.id)).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('批准（once）后落定并沉淀统一策略事件流', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端（~/.hermes）',
      decision: 'needs_confirmation',
    })

    const resolved = resolveRiskApproval(created.id, 'approved', 'once')
    expect(resolved?.status).toBe('approved')
    expect(resolved?.scope).toBe('once')

    expect(publishChatEvent).toHaveBeenCalledTimes(1)
    expect(publishChatEvent).toHaveBeenCalledWith(
      'desktop.policy_decision',
      expect.objectContaining({
        source: 'approval',
        result: 'allowed',
        action: 'execute_shell',
        subject: created.id,
        reason: 'confirmed',
        profileName: null,
        details: expect.objectContaining({
          disposition: 'confirmed',
          approvalId: created.id,
          scope: 'once',
          decisionType: 'needs_confirmation',
          channel: 'terminal',
        }),
      }),
    )
  })

  it('拒绝后落定（denied，无范围）', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })

    const resolved = resolveRiskApproval(created.id, 'denied')
    expect(resolved?.status).toBe('denied')
    expect(resolved?.scope).toBeNull()
    expect(publishChatEvent).toHaveBeenCalledWith(
      'desktop.policy_decision',
      expect.objectContaining({
        source: 'approval',
        result: 'denied',
        action: 'execute_shell',
        reason: 'rejected',
        details: expect.objectContaining({
          disposition: 'rejected',
          approvalId: created.id,
          scope: null,
        }),
      }),
    )
  })

  it('已落定或已过期的请求不可重复解析', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })

    resolveRiskApproval(created.id, 'approved', 'once')
    expect(resolveRiskApproval(created.id, 'denied')).toBeUndefined()
  })

  it('「始终允许」写回 config.yaml，移除该动作确认/审批要求', () => {
    const configPath = path.join(configTempDir, 'config.yaml')
    fs.writeFileSync(
      configPath,
      [
        'security:',
        '  risk_controls:',
        '    require_confirmation:',
        '      execute_shell: true',
        '    require_approval:',
        '      execute_shell: true',
        '',
      ].join('\n'),
      'utf-8',
    )

    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端（~/.hermes）',
      decision: 'needs_approval',
    })
    const resolved = resolveRiskApproval(created.id, 'approved', 'always')
    expect(resolved?.status).toBe('approved')
    expect(resolved?.scope).toBe('always')

    const written = fs.readFileSync(configPath, 'utf-8')
    expect(written).not.toContain('execute_shell: true')
  })

  it('「始终允许」在配置缺失时静默降级（不阻断审批）', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_confirmation',
    })

    expect(() =>
      resolveRiskApproval(created.id, 'approved', 'always'),
    ).not.toThrow()
  })

  it('消费放行凭据：已批准且动作匹配才放行', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })
    resolveRiskApproval(created.id, 'approved', 'once')

    expect(consumeRiskApprovalGrant(created.id, 'execute_shell')).toBe(true)
    // 动作不匹配不放行
    expect(consumeRiskApprovalGrant(created.id, 'navigate')).toBe(false)

    const request = getRiskApprovalRequest(created.id) as RiskApprovalRequest
    expect(request.usedCount).toBe(1)
  })

  it('未批准 / 已拒绝 / 不存在时消费失败', () => {
    const pending = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })
    expect(consumeRiskApprovalGrant(pending.id, 'execute_shell')).toBe(false)

    const denied = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })
    resolveRiskApproval(denied.id, 'denied')
    expect(consumeRiskApprovalGrant(denied.id, 'execute_shell')).toBe(false)

    expect(consumeRiskApprovalGrant('not-exists', 'execute_shell')).toBe(false)
  })

  it('clearRiskApprovalRequests 清空全部请求', () => {
    const created = createRiskApprovalRequest({
      action: 'execute_shell',
      subject: '打开终端',
      decision: 'needs_approval',
    })

    clearRiskApprovalRequests()
    expect(getRiskApprovalRequest(created.id)).toBeUndefined()
  })
})
