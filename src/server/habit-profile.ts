/**
 * 行为画像聚合器（事件驱动习惯沉淀 — 本地画像）。
 *
 * 消费统一的 `desktop.policy_decision` 事件流，将用户真实执行、纠正、拒绝、
 * 确认的行为提炼为小而可查询的本地画像，按 Hermes 档案（profile）存为
 * `~/.hermes/habits/` 下的 JSON 文件，跨重启保留且默认私有。
 *
 * 设计约束（依据 DESK-06 / 事件驱动沉淀）：
 *  - 事件驱动：聚合真实决策，而非对话指令。
 *  - 每条画像保留来源溯源（source / reason / ts），使上游规则与上下文可追溯。
 *  - 只读：绝不修改授权策略本身。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { normalizeDomain } from './domain-utils'
import type {
  PolicyResult,
  PolicySource,
  UnifiedPolicyDecision,
} from './policy-telemetry'

// ─── 类型定义 ──────────────────────────────────────────────────────────────

export interface DirectoryStat {
  path: string
  accessCount: number
  allowedCount: number
  deniedCount: number
  lastTs: number
  lastReason: string | null
}

export interface WebsiteStat {
  domain: string
  accessCount: number
  allowedCount: number
  deniedCount: number
  lastTs: number
  lastReason: string | null
}

export interface RiskActionStat {
  action: string
  allowedCount: number
  confirmationCount: number
  approvalCount: number
  lastTs: number
}

export interface CorrectionEntry {
  ts: number
  outcome: 'approved' | 'denied'
  action: string
  subject: string | null
  priorSource: PolicySource
  priorResult: PolicyResult
}

export interface HabitProfile {
  version: 1
  profileName: string
  updatedTs: number
  totalEvents: number
  directories: Array<DirectoryStat>
  websites: Array<WebsiteStat>
  riskActions: Array<RiskActionStat>
  corrections: Array<CorrectionEntry>
}

export interface HabitProfileQuery {
  profileName?: string | null
  limit?: number
}

// ─── 容量上限（防止画像膨胀）──────────────────────────────────────────────

const MAX_DIRECTORIES = 200
const MAX_WEBSITES = 200
const MAX_RISK_ACTIONS = 100
const MAX_CORRECTIONS = 50

// ─── 存储 ──────────────────────────────────────────────────────────────────

const DEFAULT_STORE_DIR = () => path.join(os.homedir(), '.hermes', 'habits')
const STORE_FILE_SUFFIX = '.json'

let storeDir = DEFAULT_STORE_DIR()

/** 覆盖存储目录（供测试使用，避免触碰真实 ~/.hermes）。 */
export function configureHabitProfile(options?: { storeDir?: string }): void {
  if (options?.storeDir && options.storeDir !== storeDir) {
    storeDir = options.storeDir
    // 存储目录已切换——此前加载的画像已失效。
    cache.clear()
  }
}

function safeFileName(profileName: string): string {
  const base = profileName === 'default' ? 'profile' : profileName
  return base.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function storeFileFor(profileName: string): string {
  return path.join(storeDir, `${safeFileName(profileName)}${STORE_FILE_SUFFIX}`)
}

// 按 profileName 缓存的内存画像；缺省表示尚未加载。
const cache = new Map<string, HabitProfile>()

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function emptyProfile(profileName: string): HabitProfile {
  return {
    version: 1,
    profileName,
    updatedTs: 0,
    totalEvents: 0,
    directories: [],
    websites: [],
    riskActions: [],
    corrections: [],
  }
}

function normalizeLoadedProfile(
  parsed: unknown,
  profileName: string,
): HabitProfile {
  const record = asRecord(parsed)
  const profile = emptyProfile(profileName)
  if (record.version === 1) {
    profile.totalEvents =
      typeof record.totalEvents === 'number' ? record.totalEvents : 0
    profile.updatedTs =
      typeof record.updatedTs === 'number' ? record.updatedTs : 0
    if (Array.isArray(record.directories)) {
      profile.directories = (record.directories as Array<DirectoryStat>).filter(
        (entry) => typeof entry?.path === 'string',
      )
    }
    if (Array.isArray(record.websites)) {
      profile.websites = (record.websites as Array<WebsiteStat>).filter(
        (entry) => typeof entry?.domain === 'string',
      )
    }
    if (Array.isArray(record.riskActions)) {
      profile.riskActions = (record.riskActions as Array<RiskActionStat>).filter(
        (entry) => typeof entry?.action === 'string',
      )
    }
    if (Array.isArray(record.corrections)) {
      profile.corrections = (record.corrections as Array<CorrectionEntry>).filter(
        (entry) => typeof entry?.ts === 'number',
      )
    }
  }
  return profile
}

function load(profileName: string): HabitProfile {
  const cached = cache.get(profileName)
  if (cached) return cached
  let profile: HabitProfile
  try {
    const raw = fs.readFileSync(storeFileFor(profileName), 'utf-8')
    profile = normalizeLoadedProfile(JSON.parse(raw), profileName)
  } catch {
    profile = emptyProfile(profileName)
  }
  cache.set(profileName, profile)
  return profile
}

function persist(profile: HabitProfile): void {
  profile.updatedTs = Date.now()
  try {
    fs.mkdirSync(storeDir, { recursive: true })
    fs.writeFileSync(
      storeFileFor(profile.profileName),
      JSON.stringify(profile, null, 2),
      'utf-8',
    )
  } catch {
    // 写盘失败绝不阻断决策链路（尽力而为）。
  }
}

function trimByCount<T>(
  items: Array<T>,
  max: number,
  score: (item: T) => number,
): void {
  if (items.length <= max) return
  items.sort((a, b) => score(b) - score(a))
  items.length = max
}

// ─── 聚合逻辑 ──────────────────────────────────────────────────────────────

function upsertDirectory(
  profile: HabitProfile,
  decision: UnifiedPolicyDecision,
): void {
  const subject = decision.subject
  if (typeof subject !== 'string' || !subject) return

  const entry = profile.directories.find((item) => item.path === subject)
  const allowed = decision.result === 'allowed'
  const denied = decision.result === 'denied'

  if (entry) {
    entry.accessCount += 1
    if (allowed) entry.allowedCount += 1
    if (denied) entry.deniedCount += 1
    entry.lastTs = decision.ts
    if (decision.reason) entry.lastReason = decision.reason
  } else {
    profile.directories.push({
      path: subject,
      accessCount: 1,
      allowedCount: allowed ? 1 : 0,
      deniedCount: denied ? 1 : 0,
      lastTs: decision.ts,
      lastReason: decision.reason ?? null,
    })
  }

  trimByCount(profile.directories, MAX_DIRECTORIES, (item) => item.accessCount)
}

function websiteDomain(decision: UnifiedPolicyDecision): string {
  const details = asRecord(decision.details)
  const host = details.host
  if (typeof host === 'string' && host.trim()) return normalizeDomain(host)
  if (typeof decision.subject === 'string' && decision.subject.trim()) {
    return normalizeDomain(decision.subject)
  }
  return ''
}

function upsertWebsite(
  profile: HabitProfile,
  decision: UnifiedPolicyDecision,
): void {
  const domain = websiteDomain(decision)
  if (!domain) return

  const entry = profile.websites.find((item) => item.domain === domain)
  const allowed = decision.result === 'allowed'
  const denied = decision.result === 'denied'

  if (entry) {
    entry.accessCount += 1
    if (allowed) entry.allowedCount += 1
    if (denied) entry.deniedCount += 1
    entry.lastTs = decision.ts
    if (decision.reason) entry.lastReason = decision.reason
  } else {
    profile.websites.push({
      domain,
      accessCount: 1,
      allowedCount: allowed ? 1 : 0,
      deniedCount: denied ? 1 : 0,
      lastTs: decision.ts,
      lastReason: decision.reason ?? null,
    })
  }

  trimByCount(profile.websites, MAX_WEBSITES, (item) => item.accessCount)
}

function riskActionScore(item: RiskActionStat): number {
  return item.allowedCount + item.confirmationCount + item.approvalCount
}

function upsertRiskAction(
  profile: HabitProfile,
  decision: UnifiedPolicyDecision,
): void {
  const action = decision.action
  if (!action) return

  const entry = profile.riskActions.find((item) => item.action === action)

  if (entry) {
    entry.allowedCount += decision.result === 'allowed' ? 1 : 0
    entry.confirmationCount += decision.result === 'needs_confirmation' ? 1 : 0
    entry.approvalCount += decision.result === 'needs_approval' ? 1 : 0
    entry.lastTs = decision.ts
  } else {
    profile.riskActions.push({
      action,
      allowedCount: decision.result === 'allowed' ? 1 : 0,
      confirmationCount: decision.result === 'needs_confirmation' ? 1 : 0,
      approvalCount: decision.result === 'needs_approval' ? 1 : 0,
      lastTs: decision.ts,
    })
  }

  trimByCount(profile.riskActions, MAX_RISK_ACTIONS, riskActionScore)
}

function pushCorrection(
  profile: HabitProfile,
  decision: UnifiedPolicyDecision,
): void {
  const details = asRecord(decision.details)
  const correlated = asRecord(details.correlated)
  const priorSource = (correlated.source as PolicySource) || 'approval'
  const priorResult = (correlated.result as PolicyResult) || 'denied'

  profile.corrections.push({
    ts: decision.ts,
    outcome: decision.result === 'allowed' ? 'approved' : 'denied',
    action: decision.action || 'authorization',
    subject: typeof decision.subject === 'string' ? decision.subject : null,
    priorSource,
    priorResult,
  })

  profile.corrections.sort((a, b) => b.ts - a.ts)
  if (profile.corrections.length > MAX_CORRECTIONS) {
    profile.corrections.length = MAX_CORRECTIONS
  }
}

/**
 * 将一条策略决策增量并入其归属档案（profileName，缺省为 default）的画像。
 * 由 publishPolicyDecision 调用。
 */
export function updateHabitProfile(decision: UnifiedPolicyDecision): void {
  const profile = load(decision.profileName ?? 'default')
  profile.totalEvents += 1

  switch (decision.source) {
    case 'directory':
      upsertDirectory(profile, decision)
      break
    case 'website':
      upsertWebsite(profile, decision)
      break
    case 'terminal':
      upsertRiskAction(profile, decision)
      break
    case 'approval':
      if (asRecord(decision.details).disposition === 'corrected') {
        pushCorrection(profile, decision)
      }
      break
  }

  persist(profile)
}

// ─── 查询 ───────────────────────────────────────────────────────────────────

export function getHabitProfile(options?: HabitProfileQuery): HabitProfile {
  const profileName = options?.profileName ?? 'default'
  const limit = options?.limit ?? 20
  const profile = load(profileName)

  return {
    ...profile,
    directories: profile.directories
      .slice()
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit),
    websites: profile.websites
      .slice()
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit),
    riskActions: profile.riskActions
      .slice()
      .sort((a, b) => riskActionScore(b) - riskActionScore(a))
      .slice(0, limit),
    corrections: profile.corrections.slice().slice(0, limit),
  }
}

/** 清空指定档案（缺省 default）的内存缓存与落盘画像。 */
export function resetHabitProfile(options?: { profileName?: string | null }): void {
  const profileName = options?.profileName ?? 'default'
  const fresh = emptyProfile(profileName)
  cache.set(profileName, fresh)
  persist(fresh)
}

/** 丢弃内存缓存（供测试模拟重启）。 */
export function clearHabitProfileCache(): void {
  cache.clear()
}
