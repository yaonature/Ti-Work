import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AuthorizationGuardError,
  assertDirectoryAccess,
  assertTerminalAccess,
  assertWebsiteAccess,
  buildDesktopSecurityPolicy,
  evaluateRiskAction,
  normalizeDomain,
} from '@/server/authorization-guard'
import { configureHabitProfile } from '@/server/habit-profile'
import {
  clearHabitSequencesCache,
  configureHabitSequences,
  flushManualWindow,
} from '@/server/habit-sequences'

vi.mock('@/server/chat-event-bus', () => ({
  publishChatEvent: vi.fn(),
}))

let habitTempDir: string

beforeEach(() => {
  // Guard assertions publish policy decisions which feed the habit profile;
  // keep that sink out of the real ~/.hermes during tests.
  habitTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-habits-'))
  configureHabitProfile({ storeDir: habitTempDir })
  // 序列存储与画像同为 default -> profile.json，用独立子目录避免互踩
  configureHabitSequences({ storeDir: path.join(habitTempDir, 'sequences') })
})

afterEach(() => {
  flushManualWindow()
  clearHabitSequencesCache()
  fs.rmSync(habitTempDir, { recursive: true, force: true })
})

describe('authorization-guard', () => {
  it('allows access inside scoped workspace root', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'scoped',
          workspace_root: 'D:\\Workspace',
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Workspace\\Cases\\a.txt',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
  })

  it('blocks access when target path falls under blocked directory', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'scoped',
          workspace_root: 'D:\\Workspace',
          blocked_paths: ['D:\\Workspace\\Private'],
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Workspace\\Private\\secret.docx',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).toThrowError(AuthorizationGuardError)

    try {
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Workspace\\Private\\secret.docx',
        fallbackRoot: 'D:\\Workspace',
      })
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe('directory_blocked')
    }
  })

  it('enforces allowlist mode with explicit allowed paths', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'allowlist',
          allowed_paths: ['D:\\LawFirm\\Workspace'],
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'write',
        resolvedPath: 'D:\\LawFirm\\Workspace\\draft.md',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'write',
        resolvedPath: 'D:\\Other\\draft.md',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).toThrowError(AuthorizationGuardError)
  })

  it('allows any path in observe mode', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'observe',
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'delete',
        resolvedPath: 'D:\\Anywhere\\danger.txt',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
  })

  it('allows read actions in a readonly directory', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'allowlist',
          readonly_paths: ['D:\\Archive'],
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Archive\\doc.pdf',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'list',
        resolvedPath: 'D:\\Archive',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
  })

  it('blocks write actions in a readonly directory with code directory_readonly', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'allowlist',
          readonly_paths: ['D:\\Archive'],
        },
      },
    })

    try {
      assertDirectoryAccess(policy, {
        action: 'write',
        resolvedPath: 'D:\\Archive\\draft.md',
        fallbackRoot: 'D:\\Workspace',
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe('directory_readonly')
    }
  })

  it('honours readonly even when the path also falls under an allowed root', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'scoped',
          workspace_root: 'D:\\Workspace',
          allowed_paths: ['D:\\Workspace'],
          readonly_paths: ['D:\\Workspace\\ReadOnly'],
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Workspace\\ReadOnly\\a.md',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()

    try {
      assertDirectoryAccess(policy, {
        action: 'rename',
        resolvedPath: 'D:\\Workspace\\ReadOnly\\a.md',
        fallbackRoot: 'D:\\Workspace',
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe('directory_readonly')
    }
  })

  it('allows reads and writes in a fully-controlled directory', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        directory_access: {
          enabled: true,
          mode: 'allowlist',
          allowed_paths: ['D:\\Cases'],
        },
      },
    })

    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'read',
        resolvedPath: 'D:\\Cases\\report.docx',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
    expect(() =>
      assertDirectoryAccess(policy, {
        action: 'write',
        resolvedPath: 'D:\\Cases\\report.docx',
        fallbackRoot: 'D:\\Workspace',
      }),
    ).not.toThrow()
  })
})

describe('authorization-guard website access', () => {
  it('normalizes url to a bare lowercase host without protocol/path/port/www', () => {
    expect(normalizeDomain('https://www.Example.com:8080/path?a=1')).toBe(
      'example.com',
    )
    expect(normalizeDomain('HTTP://SUB.Example.com/route')).toBe(
      'sub.example.com',
    )
    expect(normalizeDomain('  Example.com  ')).toBe('example.com')
  })

  it('allows access when website governance is disabled', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: { enabled: false },
      },
    })

    expect(() =>
      assertWebsiteAccess(policy, { url: 'https://banned.example.com' }),
    ).not.toThrow()
  })

  it('blocks a blocked domain and reports website_blocked', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: {
          enabled: true,
          mode: 'balanced',
          blocked_domains: ['banned.example.com'],
        },
      },
    })

    try {
      assertWebsiteAccess(policy, { url: 'https://banned.example.com/page' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe('website_blocked')
    }
  })

  it('blocks a subdomain of a blocked domain', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: {
          enabled: true,
          mode: 'balanced',
          blocked_domains: ['blocked.root.com'],
        },
      },
    })

    expect(() =>
      assertWebsiteAccess(policy, { url: 'https://sub.blocked.root.com' }),
    ).toThrowError(AuthorizationGuardError)
  })

  it('rejects domains outside the allowlist in allowlist mode', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: {
          enabled: true,
          mode: 'allowlist',
          allowed_domains: ['allowed.example.com'],
        },
      },
    })

    try {
      assertWebsiteAccess(policy, { url: 'https://other.example.com' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe(
        'website_not_allowed',
      )
    }
  })

  it('allows domains present in the allowlist, including subdomains', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: {
          enabled: true,
          mode: 'allowlist',
          allowed_domains: ['allowed.example.com'],
        },
      },
    })

    expect(() =>
      assertWebsiteAccess(policy, { url: 'https://allowed.example.com/x' }),
    ).not.toThrow()
    expect(() =>
      assertWebsiteAccess(policy, { url: 'https://sub.allowed.example.com' }),
    ).not.toThrow()
  })

  it('allows non-blocked domains in balanced mode by default', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        website_access: {
          enabled: true,
          mode: 'balanced',
          blocked_domains: ['banned.example.com'],
        },
      },
    })

    expect(() =>
      assertWebsiteAccess(policy, { url: 'https://normal.example.com' }),
    ).not.toThrow()
  })
})

describe('authorization-guard terminal access', () => {
  it('allows an action without any risk control', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        risk_controls: { require_confirmation: {}, require_approval: {} },
      },
    })

    expect(() =>
      assertTerminalAccess(policy, {
        action: 'execute_shell',
        command: 'pnpm build',
      }),
    ).not.toThrow()
  })

  it('requires confirmation when the action is set to require_confirmation', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        risk_controls: {
          require_confirmation: { execute_shell: true },
          require_approval: {},
        },
      },
    })

    try {
      assertTerminalAccess(policy, {
        action: 'execute_shell',
        command: 'rm -rf ./node_modules',
      })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe(
        'terminal_requires_confirmation',
      )
    }
  })

  it('requires approval when the action is set to require_approval', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        risk_controls: {
          require_confirmation: {},
          require_approval: { execute_shell: true },
        },
      },
    })

    try {
      assertTerminalAccess(policy, { action: 'execute_shell' })
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationGuardError)
      expect((error as AuthorizationGuardError).code).toBe(
        'terminal_requires_approval',
      )
    }
  })

  it('treats approval as higher precedence than confirmation', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        risk_controls: {
          require_confirmation: { execute_shell: true },
          require_approval: { execute_shell: true },
        },
      },
    })

    expect(evaluateRiskAction(policy, 'execute_shell')).toBe('needs_approval')
  })

  it('classifies an unconfigured action as allowed', () => {
    const policy = buildDesktopSecurityPolicy({
      security: {
        risk_controls: {
          require_confirmation: { delete: true },
          require_approval: { upload: true },
        },
      },
    })

    expect(evaluateRiskAction(policy, 'execute_shell')).toBe('allowed')
  })
})
