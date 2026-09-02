/**
 * 会话任务序列沉淀存储（P1-A 行为资产沉淀 — 序列层）。
 *
 * 与 habit-profile（计数画像）并列的「序列视图」：以「会话任务序列」为原子单位
 * 沉淀用户行为，供高频任务识别（P1-B）与未来 OPC 提纯消费。
 *
 * 两类序列来源：
 *  - agent：send-stream 会话链路收敛的 Agent 工具动作序列（sessionKey + runId +
 *    意图标签，P1-A 主线）；
 *  - manual-window：手动 Guard 链路（目录/网站/终端）按时间窗口聚合的动作组
 *    （无会话上下文，契约预留 sessionKey 可空，P1-A 辅助线）。
 *
 * 设计约束（依据方案文档 4.5.2 / 4.5.4）：
 *  - 计数画像（habit-profile.ts）与序列视图分离，互不回归；
 *  - 序列按 profileName 隔离落盘（~/.hermes/habit-sequences/），全量可删除；
 *  - 只读聚合：绝不修改授权策略本身；
 *  - 写盘失败尽力而为，绝不阻断决策链路。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { UnifiedPolicyDecision } from './policy-telemetry'
import type { IntentCategory } from '../utils/intent-classification'

// ─── 类型定义 ──────────────────────────────────────────────────────────────

export type SequenceKind = 'agent' | 'manual-window'

export type RunActionOutcome =
  | 'ok'
  | 'error'
  | 'denied'
  | 'pending_approval'
  | 'approved'
  | 'denied_approval'

/** 序列内单个有序动作节点。 */
export interface RunActionNode {
  ts: number
  order: number
  /** 泛化动作类别（Agent 工具名 / 守卫来源类别），可提纯要素。 */
  tool: string
  toolCallId: string | null
  outcome: RunActionOutcome
  /** 具体动作名（execute_shell / navigate / read …），可提纯要素。 */
  action: string | null
  /** 个人要素（路径/域名/命令原文），默认本地保留，上云剥离。 */
  subject: string | null
  /** 结果摘要（截断），本地可读。 */
  summary: string | null
}

/** 会话任务序列：一段连续操作的有序记录（原子单位）。 */
export interface SessionRunSequence {
  version: 1
  sequenceId: string
  kind: SequenceKind
  profileName: string
  /** 会话上下文。手动窗口序列为空，契约预留字段。 */
  sessionKey: string | null
  runId: string | null
  intentLabel: string | null
  intentCategory: IntentCategory | null
  intentAction: string | null
  startedTs: number
  endedTs: number
  actions: Array<RunActionNode>
}

export interface HabitSequenceQuery {
  profileName?: string | null
  limit?: number
  kind?: SequenceKind
}

interface HabitSequenceStoreFile {
  version: 1
  sequences: Array<SessionRunSequence>
}

// ─── 容量与窗口上限 ────────────────────────────────────────────────────────

export const MAX_SEQUENCES = 1200
const MAX_ACTIONS_PER_SEQUENCE = 60
/** 手动动作窗口：相邻动作超过该间隔视为新任务组。 */
const DEFAULT_MANUAL_WINDOW_GAP_MS = 5 * 60 * 1000
/** 手动动作窗口：单组动作上限，达到即强制收口。 */
const DEFAULT_MANUAL_GROUP_MAX_ACTIONS = 20
const SUBJECT_MAX_LENGTH = 240
const SUMMARY_MAX_LENGTH = 400

// ─── 存储 ──────────────────────────────────────────────────────────────────

const DEFAULT_STORE_DIR = () => path.join(os.homedir(), '.hermes', 'habit-sequences')
const STORE_FILE_SUFFIX = '.json'

let storeDir = DEFAULT_STORE_DIR()
let manualWindowGapMs = DEFAULT_MANUAL_WINDOW_GAP_MS
let manualGroupMaxActions = DEFAULT_MANUAL_GROUP_MAX_ACTIONS

/** 覆盖存储目录与窗口参数（供测试使用，避免触碰真实 ~/.hermes）。 */
export function configureHabitSequences(options?: {
  storeDir?: string
  manualWindowGapMs?: number
  manualGroupMaxActions?: number
}): void {
  if (options?.storeDir && options.storeDir !== storeDir) {
    storeDir = options.storeDir
    cache.clear()
  }
  if (options?.manualWindowGapMs !== undefined) {
    manualWindowGapMs = Math.max(1_000, options.manualWindowGapMs)
  }
  if (options?.manualGroupMaxActions !== undefined) {
    manualGroupMaxActions = Math.max(2, options.manualGroupMaxActions)
  }
}

function safeFileName(profileName: string): string {
  const base = profileName === 'default' ? 'profile' : profileName
  return base.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function storeFileFor(profileName: string): string {
  return path.join(storeDir, `${safeFileName(profileName)}${STORE_FILE_SUFFIX}`)
}

const cache = new Map<string, HabitSequenceStoreFile>()

function emptyStore(profileName: string): HabitSequenceStoreFile {
  return { version: 1, sequences: [] }
}

function normalizeLoadedStore(
  parsed: unknown,
): HabitSequenceStoreFile {
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    if (Array.isArray(record.sequences)) {
      const sequences = (record.sequences as Array<unknown>).filter(
        (item): item is SessionRunSequence =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as Record<string, unknown>).sequenceId === 'string' &&
          typeof (item as Record<string, unknown>).actions === 'object',
      )
      return { version: 1, sequences }
    }
  }
  return { version: 1, sequences: [] }
}

function loadStore(profileName: string): HabitSequenceStoreFile {
  const cached = cache.get(profileName)
  if (cached) return cached
  let store: HabitSequenceStoreFile
  try {
    const raw = fs.readFileSync(storeFileFor(profileName), 'utf-8')
    store = normalizeLoadedStore(JSON.parse(raw))
  } catch {
    store = emptyStore(profileName)
  }
  cache.set(profileName, store)
  return store
}

function persistStore(profileName: string): void {
  const store = loadStore(profileName)
  try {
    fs.mkdirSync(storeDir, { recursive: true })
    fs.writeFileSync(
      storeFileFor(profileName),
      JSON.stringify(store, null, 2),
      'utf-8',
    )
  } catch {
    // 写盘失败绝不阻断行为链路（尽力而为）。
  }
}

/** 按时间收口容量上限：仅保留最近 MAX_SEQUENCES 条。 */
function trimSequences(profileName: string): void {
  const store = loadStore(profileName)
  if (store.sequences.length <= MAX_SEQUENCES) return
  store.sequences.sort((a, b) => b.endedTs - a.endedTs)
  store.sequences.length = MAX_SEQUENCES
}

function pushSequence(profileName: string, sequence: SessionRunSequence): void {
  const store = loadStore(profileName)
  store.sequences.push(sequence)
  trimSequences(profileName)
  persistStore(profileName)
}

// ─── Agent 序列沉淀（P1-A 主线）────────────────────────────────────────────

export interface AgentSequenceInput {
  sequenceId?: string
  profileName?: string | null
  sessionKey: string | null
  runId: string | null
  intentLabel?: string | null
  intentCategory?: IntentCategory | null
  intentAction?: string | null
  startedTs: number
  endedTs: number
  actions: Array<RunActionNode>
}

/**
 * 将一次 Agent run 收敛为会话任务序列落盘。
 * 无有效动作（actions 为空）的 run 直接忽略，避免噪声序列膨胀。
 */
export function appendAgentSequence(input: AgentSequenceInput): string | null {
  const actions = (input.actions ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_ACTIONS_PER_SEQUENCE)
  if (actions.length === 0) return null

  const profileName = input.profileName ?? 'default'
  const sequenceId =
    input.sequenceId ||
    (input.runId
      ? `run:${input.runId}`
      : `seq:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`)
  const sequence: SessionRunSequence = {
    version: 1,
    sequenceId,
    kind: 'agent',
    profileName,
    sessionKey: input.sessionKey,
    runId: input.runId,
    intentLabel: input.intentLabel ?? null,
    intentCategory: input.intentCategory ?? null,
    intentAction: input.intentAction ?? null,
    startedTs: input.startedTs,
    endedTs: input.endedTs,
    actions,
  }
  pushSequence(profileName, sequence)
  return sequenceId
}

// ─── 手动 Guard 窗口聚合（P1-A 辅助线）────────────────────────────────────

interface ManualWindowGroup {
  profileName: string
  firstTs: number
  lastTs: number
  actions: Array<RunActionNode>
}

const manualGroups = new Map<string, ManualWindowGroup>()

function manualOutcome(
  decision: UnifiedPolicyDecision,
): RunActionOutcome | null {
  switch (decision.result) {
    case 'allowed':
      return 'ok'
    case 'denied':
      return 'denied'
    case 'needs_approval':
      return 'pending_approval'
    case 'needs_confirmation':
      return null
    default:
      return null
  }
}

/** 手动动作是否进入窗口聚合（只收 final / 待审批的目录、网站、终端裁决）。 */
function isManualActionSource(decision: UnifiedPolicyDecision): boolean {
  if (
    decision.source !== 'directory' &&
    decision.source !== 'website' &&
    decision.source !== 'terminal'
  ) {
    return false
  }
  return manualOutcome(decision) !== null
}

function buildManualNode(
  decision: UnifiedPolicyDecision,
  order: number,
): RunActionNode {
  const subject =
    typeof decision.subject === 'string'
      ? decision.subject.slice(0, SUBJECT_MAX_LENGTH)
      : null
  const rawDetails =
    decision.details && typeof decision.details === 'object'
      ? decision.details
      : {}
  const rawSummary =
    typeof rawDetails.summary === 'string'
      ? rawDetails.summary
      : rawDetails.preview
  const summary =
    typeof rawSummary === 'string' && rawSummary
      ? rawSummary.slice(0, SUMMARY_MAX_LENGTH)
      : null
  return {
    ts: decision.ts,
    order,
    tool: decision.source,
    toolCallId: null,
    outcome: manualOutcome(decision) as RunActionOutcome,
    action: decision.action || null,
    subject,
    summary,
  }
}

function flushManualGroup(group: ManualWindowGroup): void {
  const profileName = group.profileName
  const actions = group.actions
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, MAX_ACTIONS_PER_SEQUENCE)
  if (actions.length === 0) return
  const sequenceId = `manual:${group.firstTs}:${Math.random()
    .toString(36)
    .slice(2, 8)}`
  const sequence: SessionRunSequence = {
    version: 1,
    sequenceId,
    kind: 'manual-window',
    profileName,
    sessionKey: null,
    runId: null,
    intentLabel: null,
    intentCategory: null,
    intentAction: null,
    startedTs: group.firstTs,
    endedTs: group.lastTs,
    actions,
  }
  pushSequence(profileName, sequence)
}

/**
 * 将一条手动守卫决策并入当前时间窗口的动作组；窗口超限 / 间隔超窗时
 * 先收口前一组再开新组。由 publishPolicyDecision 统一漏斗调用。
 */
export function ingestManualDecision(
  decision: UnifiedPolicyDecision,
): void {
  if (!isManualActionSource(decision)) return

  const profileName = decision.profileName ?? 'default'
  const current = manualGroups.get(profileName)

  if (
    current &&
    current.actions.length >= manualGroupMaxActions
  ) {
    flushManualGroup(current)
    manualGroups.delete(profileName)
  }

  const group = manualGroups.get(profileName)
  if (
    group &&
    decision.ts - group.lastTs > manualWindowGapMs
  ) {
    flushManualGroup(group)
    manualGroups.delete(profileName)
  }

  let active = manualGroups.get(profileName)
  if (!active) {
    active = {
      profileName,
      firstTs: decision.ts,
      lastTs: decision.ts,
      actions: [],
    }
    manualGroups.set(profileName, active)
  }
  active.lastTs = decision.ts
  active.actions.push(buildManualNode(decision, active.actions.length))
}

/** 立即收口指定档案（或全部档案）的进行中手动窗口（测试与关停用）。 */
export function flushManualWindow(options?: {
  profileName?: string | null
}): void {
  const target = options?.profileName ?? null
  // 内存组以原始 profileName 为 key（仅落盘文件名做安全化）。
  const keys = target
    ? [target]
    : Array.from(manualGroups.keys())
  for (const key of keys) {
    const group = manualGroups.get(key)
    if (!group) continue
    flushManualGroup(group)
    manualGroups.delete(key)
  }
}

// ─── 查询与清理 ────────────────────────────────────────────────────────────

export function getHabitSequences(
  options?: HabitSequenceQuery,
): Array<SessionRunSequence> {
  const profileName = options?.profileName ?? 'default'
  const limit = options?.limit ?? 50
  const store = loadStore(profileName)
  const filtered =
    options?.kind !== undefined
      ? store.sequences.filter((seq) => seq.kind === options?.kind)
      : store.sequences
  return filtered
    .slice()
    .sort((a, b) => b.endedTs - a.endedTs)
    .slice(0, limit)
}

/** 清空指定档案（缺省 default）的序列存储（内存缓存 + 落盘）。 */
export function resetHabitSequences(options?: {
  profileName?: string | null
}): void {
  const profileName = options?.profileName ?? 'default'
  manualGroups.delete(profileName)
  cache.set(profileName, emptyStore(profileName))
  persistStore(profileName)
}

/** 丢弃内存缓存（供测试模拟重启）。 */
export function clearHabitSequencesCache(): void {
  cache.clear()
  manualGroups.clear()
}
