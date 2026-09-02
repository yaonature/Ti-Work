import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { UnifiedPolicyDecision } from '@/server/policy-telemetry'
import {
  configureHabitProfile,
  getHabitProfile,
  resetHabitProfile,
  updateHabitProfile,
} from '@/server/habit-profile'

function decision(
  partial: Pick<
    UnifiedPolicyDecision,
    'source' | 'result'
  > &
    Partial<Omit<UnifiedPolicyDecision, 'source' | 'result'>>,
): UnifiedPolicyDecision {
  return {
    action: 'list',
    subject: null,
    reason: 'test',
    profileName: null,
    details: {},
    ts: 1_700_000_000_000,
    ...partial,
  }
}

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'habits-test-'))
  configureHabitProfile({ storeDir: tempDir })
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('habit-profile', () => {
  it('returns an empty profile before any decision is recorded', () => {
    const profile = getHabitProfile()
    expect(profile.version).toBe(1)
    expect(profile.profileName).toBe('default')
    expect(profile.totalEvents).toBe(0)
    expect(profile.directories).toEqual([])
    expect(profile.websites).toEqual([])
    expect(profile.riskActions).toEqual([])
    expect(profile.corrections).toEqual([])
  })

  it('aggregates directory decisions by path with allow/deny counts', () => {
    updateHabitProfile(
      decision({
        source: 'directory',
        result: 'allowed',
        action: 'read',
        subject: 'D:\\Workspace\\docs\\report.docx',
        reason: 'within_allowed_scope',
      }),
    )
    updateHabitProfile(
      decision({
        source: 'directory',
        result: 'denied',
        action: 'delete',
        subject: 'D:\\Workspace\\docs\\report.docx',
        reason: 'blocked_path',
      }),
    )

    const profile = getHabitProfile()
    expect(profile.totalEvents).toBe(2)
    expect(profile.directories).toHaveLength(1)
    const entry = profile.directories[0]
    expect(entry.path).toBe('D:\\Workspace\\docs\\report.docx')
    expect(entry.accessCount).toBe(2)
    expect(entry.allowedCount).toBe(1)
    expect(entry.deniedCount).toBe(1)
    expect(entry.lastReason).toBe('blocked_path')
    expect(entry.lastTs).toBe(1_700_000_000_000)
  })

  it('groups website decisions by normalized domain via details.host', () => {
    updateHabitProfile(
      decision({
        source: 'website',
        result: 'allowed',
        action: 'navigate',
        subject: 'https://www.Example.com/page',
        details: { host: 'example.com' },
      }),
    )
    updateHabitProfile(
      decision({
        source: 'website',
        result: 'denied',
        action: 'navigate',
        subject: 'https://example.com/admin',
        details: { host: 'example.com', blockedBy: 'admin.example.com' },
      }),
    )

    const profile = getHabitProfile()
    expect(profile.websites).toHaveLength(1)
    const entry = profile.websites[0]
    expect(entry.domain).toBe('example.com')
    expect(entry.accessCount).toBe(2)
    expect(entry.allowedCount).toBe(1)
    expect(entry.deniedCount).toBe(1)
  })

  it('extracts the domain from the subject url when details.host is absent', () => {
    updateHabitProfile(
      decision({
        source: 'website',
        result: 'allowed',
        action: 'navigate',
        subject: 'https://Sub.Example.COM:8443/path?q=1',
      }),
    )

    const profile = getHabitProfile()
    expect(profile.websites).toHaveLength(1)
    expect(profile.websites[0].domain).toBe('sub.example.com')
  })

  it('tracks risk-action tendencies across allow/confirm/approve', () => {
    updateHabitProfile(
      decision({
        source: 'terminal',
        result: 'allowed',
        action: 'execute_shell',
        subject: 'pnpm build',
      }),
    )
    updateHabitProfile(
      decision({
        source: 'terminal',
        result: 'needs_confirmation',
        action: 'execute_shell',
        subject: 'rm -rf ./node_modules',
      }),
    )
    updateHabitProfile(
      decision({
        source: 'terminal',
        result: 'needs_approval',
        action: 'execute_shell',
        subject: 'shutdown /s',
      }),
    )

    const profile = getHabitProfile()
    expect(profile.riskActions).toHaveLength(1)
    const entry = profile.riskActions[0]
    expect(entry.action).toBe('execute_shell')
    expect(entry.allowedCount).toBe(1)
    expect(entry.confirmationCount).toBe(1)
    expect(entry.approvalCount).toBe(1)
  })

  it('records only corrected approval decisions as corrections', () => {
    updateHabitProfile(
      decision({
        source: 'approval',
        result: 'allowed',
        action: 'navigate',
        subject: 'main:abc',
        details: {
          disposition: 'corrected',
          correlated: { source: 'website', result: 'denied', action: 'navigate' },
        },
      }),
    )
    updateHabitProfile(
      decision({
        source: 'approval',
        result: 'allowed',
        action: 'execute_shell',
        subject: 'main:def',
        details: { disposition: 'confirmed' },
      }),
    )

    const profile = getHabitProfile()
    expect(profile.corrections).toHaveLength(1)
    const entry = profile.corrections[0]
    expect(entry.outcome).toBe('approved')
    expect(entry.priorSource).toBe('website')
    expect(entry.priorResult).toBe('denied')
  })

  it('isolates profiles by profileName', () => {
    updateHabitProfile(
      decision({
        source: 'directory',
        result: 'allowed',
        subject: 'D:\\Team\\docs',
        profileName: 'bob',
      }),
    )

    const bob = getHabitProfile({ profileName: 'bob' })
    expect(bob.directories).toHaveLength(1)
    expect(bob.profileName).toBe('bob')

    const admin = getHabitProfile({ profileName: 'admin' })
    expect(admin.directories).toHaveLength(0)
    expect(admin.totalEvents).toBe(0)
  })

  it('sorts entries by count descending and respects limit', () => {
    for (let i = 0; i < 5; i += 1) {
      for (let n = 0; n < i + 1; n += 1) {
        updateHabitProfile(
          decision({
            source: 'directory',
            result: 'allowed',
            subject: `D:\\Workspace\\dir${i}`,
          }),
        )
      }
    }

    const profile = getHabitProfile({ limit: 2 })
    expect(profile.directories).toHaveLength(2)
    expect(profile.directories[0].path).toBe('D:\\Workspace\\dir4')
    expect(profile.directories[0].accessCount).toBe(5)
    expect(profile.directories[1].path).toBe('D:\\Workspace\\dir3')
  })

  it('persists the aggregated profile to disk', () => {
    updateHabitProfile(
      decision({
        source: 'website',
        result: 'allowed',
        subject: 'https://docs.example.com',
        details: { host: 'docs.example.com' },
      }),
    )

    const storeFile = path.join(tempDir, 'profile.json')
    expect(fs.existsSync(storeFile)).toBe(true)
    const raw = JSON.parse(fs.readFileSync(storeFile, 'utf-8'))
    expect(raw.totalEvents).toBe(1)
    expect(raw.websites[0].domain).toBe('docs.example.com')
  })

  it('resets the profile for a given profileName', () => {
    updateHabitProfile(
      decision({
        source: 'directory',
        result: 'allowed',
        subject: 'D:\\Workspace',
      }),
    )
    expect(getHabitProfile().totalEvents).toBe(1)

    resetHabitProfile()
    const profile = getHabitProfile()
    expect(profile.totalEvents).toBe(0)
    expect(profile.directories).toEqual([])
  })
})
