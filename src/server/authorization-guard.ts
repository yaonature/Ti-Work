import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { getHermesConfigPath } from './env-models'
import {  publishPolicyDecision } from './policy-telemetry'
import {
  isDomainWithinScope,
  normalizeDomain,
} from './domain-utils'
import type {PolicyResult} from './policy-telemetry';

export type FileGuardAction =
  | 'list'
  | 'read'
  | 'download'
  | 'write'
  | 'rename'
  | 'delete'
  | 'upload'
  | 'mkdir'

type PolicyMode = 'scoped' | 'allowlist' | 'observe'

// 写操作（会改动/删除目录内容）需区分对待；只读目录仅放行 list/read/download。
const WRITE_ACTIONS = new Set<FileGuardAction>([
  'write',
  'rename',
  'delete',
  'upload',
  'mkdir',
])

export interface DesktopSecurityPolicy {
  directoryAccess: {
    enabled: boolean
    mode: PolicyMode
    workspaceRoot: string | null
    allowedPaths: Array<string>
    readonlyPaths: Array<string>
    blockedPaths: Array<string>
  }
  websiteAccess: {
    enabled: boolean
    mode: 'balanced' | 'allowlist' | 'ask'
    allowedDomains: Array<string>
    blockedDomains: Array<string>
  }
  riskControls: {
    requireConfirmation: Record<string, boolean>
    requireApproval: Record<string, boolean>
  }
  approvals: {
    mode: 'manual' | 'auto' | 'off'
    timeout: number
  }
}

export class AuthorizationGuardError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(
    message: string,
    options: {
      status?: number
      code: string
      details?: Record<string, unknown>
    },
  ) {
    super(message)
    this.name = 'AuthorizationGuardError'
    this.status = options.status ?? 403
    this.code = options.code
    this.details = options.details
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value === 'true'
  return fallback
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function asStringArray(
  value: unknown,
  options?: { lowercase?: boolean },
): Array<string> {
  if (!Array.isArray(value)) return []
  const normalized = value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => (options?.lowercase ? item.toLowerCase() : item))
  return Array.from(new Set(normalized))
}

function normalizeAbsolute(input: string): string {
  return path.resolve(input)
}

function isPathWithinScope(targetPath: string, scopePath: string): boolean {
  const target = normalizeAbsolute(targetPath)
  const scope = normalizeAbsolute(scopePath)
  const relative = path.relative(scope, target)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

export {
  isDomainWithinScope,
  normalizeDomain,
} from './domain-utils'

export function buildDesktopSecurityPolicy(
  config: Record<string, unknown>,
): DesktopSecurityPolicy {
  const securityConfig = asRecord(config.security)
  const directoryAccessConfig = asRecord(securityConfig.directory_access)
  const websiteAccessConfig = asRecord(securityConfig.website_access)
  const websiteBlocklistConfig = asRecord(securityConfig.website_blocklist)
  const riskControlsConfig = asRecord(securityConfig.risk_controls)
  const approvalsConfig = asRecord(config.approvals)

  return {
    directoryAccess: {
      enabled: asBoolean(directoryAccessConfig.enabled, true),
      mode:
        (directoryAccessConfig.mode as PolicyMode | undefined) || 'scoped',
      workspaceRoot:
        typeof directoryAccessConfig.workspace_root === 'string' &&
        directoryAccessConfig.workspace_root.trim()
          ? directoryAccessConfig.workspace_root.trim()
          : null,
      allowedPaths: asStringArray(directoryAccessConfig.allowed_paths),
      readonlyPaths: asStringArray(directoryAccessConfig.readonly_paths),
      blockedPaths: asStringArray(directoryAccessConfig.blocked_paths),
    },
    websiteAccess: {
      enabled:
        asBoolean(websiteAccessConfig.enabled, true) ||
        asBoolean(websiteBlocklistConfig.enabled, false),
      mode:
        (websiteAccessConfig.mode as 'balanced' | 'allowlist' | 'ask') ||
        'balanced',
      allowedDomains: asStringArray(websiteAccessConfig.allowed_domains, {
        lowercase: true,
      }),
      blockedDomains: Array.from(
        new Set([
          ...asStringArray(websiteAccessConfig.blocked_domains, {
            lowercase: true,
          }),
          ...asStringArray(websiteBlocklistConfig.domains, {
            lowercase: true,
          }),
        ]),
      ),
    },
    riskControls: {
      requireConfirmation: Object.fromEntries(
        Object.entries(asRecord(riskControlsConfig.require_confirmation)).map(
          ([key, value]) => [key, asBoolean(value, false)],
        ),
      ),
      requireApproval: Object.fromEntries(
        Object.entries(asRecord(riskControlsConfig.require_approval)).map(
          ([key, value]) => [key, asBoolean(value, false)],
        ),
      ),
    },
    approvals: {
      mode:
        (approvalsConfig.mode as 'manual' | 'auto' | 'off' | undefined) ||
        'manual',
      timeout: asNumber(approvalsConfig.timeout, 60),
    },
  }
}

export function readDesktopSecurityPolicy(): DesktopSecurityPolicy {
  try {
    const raw = fs.readFileSync(getHermesConfigPath(), 'utf-8')
    const parsed = (YAML.parse(raw) as Record<string, unknown>) || {}
    return buildDesktopSecurityPolicy(parsed)
  } catch {
    return buildDesktopSecurityPolicy({})
  }
}

function getAllowedRoots(
  policy: DesktopSecurityPolicy,
  fallbackRoot: string,
): Array<string> {
  const roots: Array<string> = []
  const { directoryAccess } = policy

  if (directoryAccess.workspaceRoot) roots.push(directoryAccess.workspaceRoot)
  roots.push(...directoryAccess.allowedPaths)

  if (directoryAccess.mode === 'scoped') {
    roots.push(fallbackRoot)
  }

  return Array.from(new Set(roots.map((item) => normalizeAbsolute(item))))
}

function publishDirectoryPolicyEvent(input: {
  result: PolicyResult
  reason: string
  action: FileGuardAction
  path: string
  profileName?: string | null
  blockedBy?: string
  allowedRoots?: Array<string>
}) {
  publishPolicyDecision({
    source: 'directory',
    result: input.result,
    action: input.action,
    subject: input.path,
    reason: input.reason,
    profileName: input.profileName ?? null,
    details: {
      blockedBy: input.blockedBy,
      allowedRoots: input.allowedRoots,
    },
  })
}

export function assertDirectoryAccess(
  policy: DesktopSecurityPolicy,
  options: {
    action: FileGuardAction
    resolvedPath: string
    fallbackRoot: string
    profileName?: string | null
  },
): void {
  const targetPath = normalizeAbsolute(options.resolvedPath)

  if (!policy.directoryAccess.enabled) {
    publishDirectoryPolicyEvent({
      result: 'allowed',
      reason: 'directory_access_disabled',
      action: options.action,
      path: targetPath,
      profileName: options.profileName ?? null,
    })
    return
  }

  const blockedRoots = policy.directoryAccess.blockedPaths.map((item) =>
    normalizeAbsolute(item),
  )
  const blockedBy = blockedRoots.find((item) => isPathWithinScope(targetPath, item))
  if (blockedBy) {
    publishDirectoryPolicyEvent({
      result: 'denied',
      reason: 'blocked_path',
      action: options.action,
      path: targetPath,
      blockedBy,
      profileName: options.profileName ?? null,
    })
    throw new AuthorizationGuardError('当前目录已被权限策略禁止访问。', {
      code: 'directory_blocked',
      details: {
        action: options.action,
        path: targetPath,
        blockedBy,
      },
    })
  }

  if (policy.directoryAccess.mode === 'observe') {
    publishDirectoryPolicyEvent({
      result: 'allowed',
      reason: 'observe_mode',
      action: options.action,
      path: targetPath,
      profileName: options.profileName ?? null,
    })
    return
  }

  // 只读目录：允许 list/read/download，但禁止 write/rename/delete/upload/mkdir。
  const readonlyRoots = policy.directoryAccess.readonlyPaths.map((item) =>
    normalizeAbsolute(item),
  )
  const readonlyBy = readonlyRoots.find((item) =>
    isPathWithinScope(targetPath, item),
  )
  if (readonlyBy) {
    if (WRITE_ACTIONS.has(options.action)) {
      publishDirectoryPolicyEvent({
        result: 'denied',
        reason: 'readonly_path_write',
        action: options.action,
        path: targetPath,
        blockedBy: readonlyBy,
        profileName: options.profileName ?? null,
      })
      throw new AuthorizationGuardError(
        '当前目录为只读授权，禁止新增、写入、删除或重命名。',
        {
          code: 'directory_readonly',
          details: {
            action: options.action,
            path: targetPath,
            readonlyPath: readonlyBy,
          },
        },
      )
    }

    publishDirectoryPolicyEvent({
      result: 'allowed',
      reason: 'readonly_path_read',
      action: options.action,
      path: targetPath,
      profileName: options.profileName ?? null,
    })
    return
  }

  const allowedRoots = getAllowedRoots(policy, options.fallbackRoot)
  const isAllowed = allowedRoots.some((item) => isPathWithinScope(targetPath, item))

  if (!isAllowed) {
    publishDirectoryPolicyEvent({
      result: 'denied',
      reason: 'outside_allowed_scope',
      action: options.action,
      path: targetPath,
      allowedRoots,
      profileName: options.profileName ?? null,
    })
    throw new AuthorizationGuardError(
      '当前目录不在已授权的工作区范围内，请先在权限与安全中完成授权。',
      {
        code: 'directory_not_allowed',
        details: {
          action: options.action,
          path: targetPath,
          allowedRoots,
        },
      },
    )
  }

  publishDirectoryPolicyEvent({
    result: 'allowed',
    reason: 'within_allowed_scope',
    action: options.action,
    path: targetPath,
    profileName: options.profileName ?? null,
  })
}

export function enforceDirectoryAccess(options: {
  action: FileGuardAction
  resolvedPath: string
  fallbackRoot: string
  profileName?: string | null
}): void {
  const policy = readDesktopSecurityPolicy()
  assertDirectoryAccess(policy, options)
}

function publishWebsitePolicyEvent(input: {
  result: PolicyResult
  reason: string
  action: string
  url: string
  host?: string
  blockedBy?: string
  profileName?: string | null
}) {
  publishPolicyDecision({
    source: 'website',
    result: input.result,
    action: input.action,
    subject: input.url,
    reason: input.reason,
    profileName: input.profileName ?? null,
    details: {
      host: input.host,
      blockedBy: input.blockedBy,
    },
  })
}

export function assertWebsiteAccess(
  policy: DesktopSecurityPolicy,
  options: {
    url: string
    action?: string
    profileName?: string | null
  },
): void {
  const action = options.action ?? 'navigate'
  const sourceUrl = options.url

  if (!policy.websiteAccess.enabled) {
    publishWebsitePolicyEvent({
      result: 'allowed',
      reason: 'website_access_disabled',
      action,
      url: sourceUrl,
      profileName: options.profileName ?? null,
    })
    return
  }

  const host = normalizeDomain(sourceUrl)

  const blockedBy = policy.websiteAccess.blockedDomains.find((domain) =>
    isDomainWithinScope(host, domain),
  )
  if (blockedBy) {
    publishWebsitePolicyEvent({
      result: 'denied',
      reason: 'blocked_domain',
      action,
      url: sourceUrl,
      host,
      blockedBy,
      profileName: options.profileName ?? null,
    })
    throw new AuthorizationGuardError('当前网站已被权限策略禁止访问。', {
      code: 'website_blocked',
      details: {
        action,
        url: sourceUrl,
        host,
        blockedBy,
      },
    })
  }

  if (policy.websiteAccess.mode === 'allowlist') {
    const allowedBy = policy.websiteAccess.allowedDomains.find((domain) =>
      isDomainWithinScope(host, domain),
    )
    if (!allowedBy) {
      publishWebsitePolicyEvent({
        result: 'denied',
        reason: 'not_in_allowlist',
        action,
        url: sourceUrl,
        host,
        profileName: options.profileName ?? null,
      })
      throw new AuthorizationGuardError(
        '当前网站不在已授权的域名范围内，请先在权限与安全中完成授权。',
        {
          code: 'website_not_allowed',
          details: {
            action,
            url: sourceUrl,
            host,
          },
        },
      )
    }
  }

  publishWebsitePolicyEvent({
    result: 'allowed',
    reason: 'within_allowed_policy',
    action,
    url: sourceUrl,
    host,
    profileName: options.profileName ?? null,
  })
}

export function enforceWebsiteAccess(options: {
  url: string
  action?: string
  profileName?: string | null
}): void {
  const policy = readDesktopSecurityPolicy()
  assertWebsiteAccess(policy, options)
}

export type RiskDecision = 'allowed' | 'needs_confirmation' | 'needs_approval'

export function evaluateRiskAction(
  policy: DesktopSecurityPolicy,
  action: string,
): RiskDecision {
  const { requireConfirmation, requireApproval } = policy.riskControls
  if (requireApproval[action]) return 'needs_approval'
  if (requireConfirmation[action]) return 'needs_confirmation'
  return 'allowed'
}

function publishTerminalPolicyEvent(input: {
  result: PolicyResult
  reason: string
  action: string
  command?: string
  profileName?: string | null
}) {
  publishPolicyDecision({
    source: 'terminal',
    result: input.result,
    action: input.action,
    subject: input.command ?? null,
    reason: input.reason,
    profileName: input.profileName ?? null,
  })
}

export function assertTerminalAccess(
  policy: DesktopSecurityPolicy,
  options: {
    action: string
    command?: string
    profileName?: string | null
  },
): void {
  const { action, command, profileName } = options
  const decision = evaluateRiskAction(policy, action)

  if (decision === 'needs_approval') {
    publishTerminalPolicyEvent({
      result: 'needs_approval',
      reason: 'requires_approval',
      action,
      command: command ?? null,
      profileName: profileName ?? null,
    })
    throw new AuthorizationGuardError('该终端命令需要管理员审批后才能执行。', {
      code: 'terminal_requires_approval',
      details: {
        action,
        command: command ?? null,
      },
    })
  }

  if (decision === 'needs_confirmation') {
    publishTerminalPolicyEvent({
      result: 'needs_confirmation',
      reason: 'requires_confirmation',
      action,
      command: command ?? null,
      profileName: profileName ?? null,
    })
    throw new AuthorizationGuardError('该终端命令需要您确认后再执行。', {
      code: 'terminal_requires_confirmation',
      details: {
        action,
        command: command ?? null,
      },
    })
  }

  publishTerminalPolicyEvent({
    result: 'allowed',
    reason: 'no_risk_control',
    action,
    command: command ?? null,
    profileName: profileName ?? null,
  })
}

export function enforceTerminalAccess(options: {
  action: string
  command?: string
  profileName?: string | null
}): void {
  const policy = readDesktopSecurityPolicy()
  assertTerminalAccess(policy, options)
}
