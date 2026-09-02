import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearPolicyTelemetry,
  getPolicyTelemetry,
  publishPolicyDecision,
  recordAuthorizationDecision,
} from '@/server/policy-telemetry'
import { configureHabitProfile } from '@/server/habit-profile'
import {
  clearHabitSequencesCache,
  configureHabitSequences,
  flushManualWindow,
  getHabitSequences,
} from '@/server/habit-sequences'

const publishChatEvent = vi.fn()

vi.mock('@/server/chat-event-bus', () => ({
  publishChatEvent: (...args: Array<unknown>) => publishChatEvent(...args),
}))

let habitTempDir: string

beforeEach(() => {
  publishChatEvent.mockClear()
  clearPolicyTelemetry()
  // Route the habit-profile sink away from the real ~/.hermes during tests.
  habitTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-telemetry-habits-'))
  configureHabitProfile({ storeDir: habitTempDir })
  // 序列存储与画像同为 default -> profile.json，测试用独立子目录避免互踩
  configureHabitSequences({ storeDir: path.join(habitTempDir, 'sequences') })
})

afterEach(() => {
  clearPolicyTelemetry()
  flushManualWindow()
  clearHabitSequencesCache()
  fs.rmSync(habitTempDir, { recursive: true, force: true })
})

describe('policy-telemetry', () => {
  it('publishes a unified policy_decision event to the chat event bus', () => {
    publishPolicyDecision({
      source: 'directory',
      result: 'denied',
      action: 'read',
      subject: 'D:\\Workspace\\Private\\secret.docx',
      reason: 'blocked_path',
      profileName: 'bob',
      details: { blockedBy: 'D:\\Workspace\\Private' },
    })

    expect(publishChatEvent).toHaveBeenCalledTimes(1)
    expect(publishChatEvent).toHaveBeenCalledWith(
      'desktop.policy_decision',
      expect.objectContaining({
        sessionKey: 'all',
        source: 'directory',
        result: 'denied',
        action: 'read',
        subject: 'D:\\Workspace\\Private\\secret.docx',
        reason: 'blocked_path',
        profileName: 'bob',
        ts: expect.any(Number),
      }),
    )
  })

  it('sediments decisions into the telemetry queue', () => {
    publishPolicyDecision({
      source: 'terminal',
      result: 'allowed',
      action: 'execute_shell',
      subject: 'pnpm build',
      reason: 'no_risk_control',
    })
    publishPolicyDecision({
      source: 'website',
      result: 'denied',
      action: 'navigate',
      subject: 'https://banned.example.com',
      reason: 'blocked_domain',
    })

    const entries = getPolicyTelemetry()
    expect(entries).toHaveLength(2)
    expect(entries[0]?.source).toBe('terminal')
    expect(entries[1]?.source).toBe('website')
    expect(entries[1]?.subject).toBe('https://banned.example.com')
  })

  it('filters the queue by source', () => {
    publishPolicyDecision({
      source: 'directory',
      result: 'allowed',
      action: 'list',
      subject: 'D:\\Workspace',
      reason: 'within_allowed_scope',
    })
    publishPolicyDecision({
      source: 'terminal',
      result: 'needs_approval',
      action: 'execute_shell',
      subject: 'rm -rf ./node_modules',
      reason: 'requires_approval',
    })

    const entries = getPolicyTelemetry({ source: 'terminal' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.result).toBe('needs_approval')
  })

  it('filters the queue by result', () => {
    publishPolicyDecision({
      source: 'website',
      result: 'allowed',
      action: 'navigate',
      subject: 'https://a.example.com',
      reason: 'within_allowed_policy',
    })
    publishPolicyDecision({
      source: 'website',
      result: 'denied',
      action: 'navigate',
      subject: 'https://b.example.com',
      reason: 'blocked_domain',
    })
    publishPolicyDecision({
      source: 'website',
      result: 'needs_confirmation',
      action: 'navigate',
      subject: 'https://c.example.com',
      reason: 'requires_confirmation',
    })

    const entries = getPolicyTelemetry({ result: 'needs_confirmation' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.reason).toBe('requires_confirmation')
  })

  it('respects the limit when reading the queue', () => {
    for (let i = 0; i < 5; i += 1) {
      publishPolicyDecision({
        source: 'directory',
        result: 'allowed',
        action: 'list',
        subject: `D:\\Workspace\\${i}`,
        reason: 'within_allowed_scope',
      })
    }

    const entries = getPolicyTelemetry({ limit: 2 })
    expect(entries).toHaveLength(2)
    expect(entries[0]?.subject).toBe('D:\\Workspace\\3')
    expect(entries[1]?.subject).toBe('D:\\Workspace\\4')
  })

  it('clears the telemetry queue', () => {
    publishPolicyDecision({
      source: 'terminal',
      result: 'allowed',
      action: 'execute_shell',
      subject: 'git status',
      reason: 'no_risk_control',
    })
    expect(getPolicyTelemetry()).toHaveLength(1)

    clearPolicyTelemetry()
    expect(getPolicyTelemetry()).toHaveLength(0)
  })

  it('feeds manual guard decisions into habit-sequence window aggregation', () => {
    publishPolicyDecision({
      source: 'terminal',
      result: 'allowed',
      action: 'execute_shell',
      subject: 'pnpm build',
      reason: 'no_risk_control',
    })
    // 审批响应虽也经统一漏斗，但不应进入手动窗口序列
    publishPolicyDecision({
      source: 'approval',
      result: 'allowed',
      action: 'execute_shell',
      subject: 'main:abc',
      reason: 'confirmed',
    })

    flushManualWindow()
    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(1)
    expect(sequences[0].kind).toBe('manual-window')
    expect(sequences[0].actions).toHaveLength(1)
    expect(sequences[0].actions[0].tool).toBe('terminal')
    expect(sequences[0].actions[0].outcome).toBe('ok')
    expect(sequences[0].actions[0].subject).toBe('pnpm build')
  })
})

describe('policy-telemetry authorization decisions', () => {
  it('records an approval over a pending prompt as confirmed', () => {
    publishPolicyDecision({
      source: 'terminal',
      result: 'needs_approval',
      action: 'execute_shell',
      subject: 'rm -rf ./node_modules',
      reason: 'requires_approval',
    })

    const { disposition, decision } = recordAuthorizationDecision({
      outcome: 'approved',
      approvalId: 'main:abc-123',
      subject: 'rm -rf ./node_modules',
      scope: 'once',
    })

    expect(disposition).toBe('confirmed')
    expect(decision.source).toBe('approval')
    expect(decision.result).toBe('allowed')
    expect(decision.reason).toBe('confirmed')
    expect(decision.details).toMatchObject({
      disposition: 'confirmed',
      approvalId: 'main:abc-123',
      scope: 'once',
    })
    expect(publishChatEvent).toHaveBeenCalledTimes(2)
  })

  it('records a denial over a pending prompt as rejected', () => {
    publishPolicyDecision({
      source: 'terminal',
      result: 'needs_approval',
      action: 'execute_shell',
      subject: 'rm -rf ./node_modules',
      reason: 'requires_approval',
    })

    const { disposition, decision } = recordAuthorizationDecision({
      outcome: 'denied',
      approvalId: 'main:abc-123',
      subject: 'rm -rf ./node_modules',
    })

    expect(disposition).toBe('rejected')
    expect(decision.result).toBe('denied')
    expect(decision.reason).toBe('rejected')
  })

  it('marks an approval over a guard block as corrected', () => {
    publishPolicyDecision({
      source: 'website',
      result: 'denied',
      action: 'navigate',
      subject: 'https://banned.example.com',
      reason: 'blocked_domain',
    })

    const { disposition } = recordAuthorizationDecision({
      outcome: 'approved',
      subject: 'https://banned.example.com',
    })

    expect(disposition).toBe('corrected')
  })

  it('marks a denial over a guard allow as corrected', () => {
    publishPolicyDecision({
      source: 'directory',
      result: 'allowed',
      action: 'read',
      subject: 'D:\\Workspace\\public\\report.docx',
      reason: 'within_allowed_scope',
    })

    const { disposition } = recordAuthorizationDecision({
      outcome: 'denied',
      subject: 'D:\\Workspace\\public\\report.docx',
    })

    expect(disposition).toBe('corrected')
  })

  it('falls back to confirmed/rejected when no correlated decision exists', () => {
    const approved = recordAuthorizationDecision({
      outcome: 'approved',
      approvalId: 'main:no-prior',
    })
    expect(approved.disposition).toBe('confirmed')

    const denied = recordAuthorizationDecision({
      outcome: 'denied',
      approvalId: 'main:no-prior',
    })
    expect(denied.disposition).toBe('rejected')
  })
})
