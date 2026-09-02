/**
 * 高频任务识别服务（P1-B 行为资产沉淀 — 任务画像层）。
 *
 * P1-A 已把用户让 Agent 执行的操作沉淀为「会话任务序列」（agent run /
 * manual-window，见 habit-sequences.ts）。本模块在序列层之上做**跨会话
 * 结构相似度聚类**，识别用户反复执行的高频工作任务：
 *
 *  - 任务锚点：同（意图类别 + 意图动作）为同一任务族（可泛化要素）；
 *  - 结构签名：序列内成功步骤的泛化动作链（tool:action，剥离个人要素），
 *    连续重复步骤折叠，容忍同一动作被审批流程拆分记账；
 *  - 结构相似度：两条签名的 LCS 覆盖率 ≥ 阈值视为同一步骤模板
 *    （允许个别步骤浮动，如多一步检索/少一步确认）；
 *  - 频次 / 周期：按「会话 + 自然日」去重后出现次数 ≥ minFrequency；
 *    跨自然日 ≥ 2 天标记为周期性任务；
 *  - 参数样例：聚类成员中高频出现的个人要素（具体路径/域名/命令原文），
 *    仅本地保留，是未来参数化重放的种子（上云前剥离）。
 *
 * 产出「高频任务画像」：任务意图 + 步骤模板 + 参数样例 + 频次/周期。
 *
 * 识别范围（设计约束）：
 *  - 只识别 kind='agent' 且意图类别非 chat 的序列——手动窗口序列无对话
 *    意图语义，无法支撑「点击重放」召回，不进任务画像（其频次画像已由
 *    habit-profile 计数视图承接）；
 *  - 纯本地只读：不触碰计数画像（habit-profile.ts），不改授权策略本身；
 *  - 识别结果不自动上云，上云由用户 / 平台显式触发。
 *
 * 核心 detectHighFrequencyTasks 为纯函数（无 IO），便于单测与复用；
 * getHighFrequencyTasks 仅负责从序列存储读取数据后调用纯函数。
 */

import { MAX_SEQUENCES, getHabitSequences } from './habit-sequences'
import type { IntentCategory } from '../utils/intent-classification'
import type { RunActionNode, SessionRunSequence } from './habit-sequences'

// ─── 默认参数 ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000

/** 产品默认观察窗口：最近 30 天内的序列才参与高频识别（保证习惯新鲜度）。 */
export const DEFAULT_HIGH_FREQUENCY_WINDOW_MS = 30 * DAY_MS
/** 同任务最低出现次数（去重后），达到才算「高频」。 */
export const DEFAULT_MIN_FREQUENCY = 3
/** 序列至少含多少个有效成功步骤才可能构成可重放的任务模板。 */
export const DEFAULT_MIN_ACTIONS_PER_SEQUENCE = 2
/** 结构签名 LCS 覆盖率合并阈值（0.75：允许四步任务浮动一步）。 */
export const DEFAULT_MERGE_SIMILARITY = 0.75
/** 单次查询返回任务画像上限。 */
export const DEFAULT_HIGH_FREQUENCY_LIMIT = 20
/** 参数样例最多返回条数。 */
export const DEFAULT_SAMPLE_LIMIT = 5

// ─── 类型定义 ──────────────────────────────────────────────────────────────

/** 步骤模板节点（可泛化要素，个人要素已剥离）。 */
export interface HighFrequencyTaskStep {
  /** 泛化动作类别（Agent 工具名 / 守卫来源类别）。 */
  tool: string
  /** 具体动作名。 */
  action: string | null
}

/** 参数样例：聚类中反复出现的个人要素（本地保留，上云剥离）。 */
export interface ParameterSample {
  value: string
  /** 出现次数（每个执行至多计一次）。 */
  count: number
}

/** 高频任务画像：一段被反复执行的任务的可复用描述。 */
export interface HighFrequencyTaskProfile {
  /** 稳定任务标识（意图锚点 + 步骤模板哈希，跨调用不变）。 */
  taskId: string
  /** 意图类别（可泛化要素）。 */
  intentCategory: IntentCategory
  /** 意图动作（可泛化要素）。 */
  intentAction: string
  /** 最近一次执行的任务措辞（个人要素，本地展示用）。 */
  intentLabel: string | null
  /** 步骤模板：最典型执行的成功步骤链。 */
  stepCount: number
  steps: Array<HighFrequencyTaskStep>
  /** 个人要素样例（按出现次数降序）。 */
  parameterSamples: Array<ParameterSample>
  /** 去重后出现次数。 */
  occurrenceCount: number
  /** 覆盖的自然日数量（本地时区日界线近似为 UTC 自然日）。 */
  distinctDays: number
  firstTs: number
  lastTs: number
  /** 是否跨天反复出现（周期信号，供 UI 徽标区分「高频」与「周期任务」）。 */
  isPeriodic: boolean
}

export interface HighFrequencyTaskQuery {
  profileName?: string | null
  /** 观察窗口毫秒；null = 不设窗口（全量历史）。缺省为最近 30 天。 */
  windowMs?: number | null
  limit?: number
}

/** 纯函数识别参数（阈值可覆盖，供测试与后续产品调优）。 */
export interface DetectHighFrequencyTasksOptions {
  /** 当前时间（测试注入，保证确定性）。缺省 Date.now()。 */
  now?: number
  /** 观察窗口毫秒；null / 缺省 = 不设窗口。 */
  windowMs?: number | null
  minFrequency?: number
  minActionsPerSequence?: number
  mergeSimilarity?: number
  limit?: number
  sampleLimit?: number
}

// ─── 候选构造 ──────────────────────────────────────────────────────────────

/** 只保留真实落地且成功的步骤（含审批通过）；错误 / 被拒分支不入模板。 */
const TEMPLATE_OUTCOMES: ReadonlySet<RunActionNode['outcome']> = new Set([
  'ok',
  'approved',
])

interface TaskCandidate {
  ts: number
  sessionKey: string | null
  category: IntentCategory
  action: string
  label: string | null
  /** 结构签名：有序成功步骤码（tool:action），连续重复已折叠。 */
  codes: Array<string>
  steps: Array<HighFrequencyTaskStep>
  /** 各步骤的个人要素（路径/域名/命令原文，本地保留）。 */
  subjects: Array<string>
}

function buildCandidate(
  sequence: SessionRunSequence,
  minActions: number,
): TaskCandidate | null {
  // 识别范围：仅 agent 序列且带非 chat 意图锚点（见模块头「识别范围」）。
  if (sequence.kind !== 'agent') return null
  const { intentCategory, intentAction } = sequence
  if (!intentCategory || intentCategory === 'chat') return null
  if (!intentAction) return null

  const ordered = sequence.actions
    .slice()
    .sort((a, b) => a.order - b.order)
  const codes: Array<string> = []
  const steps: Array<HighFrequencyTaskStep> = []
  const subjects: Array<string> = []
  for (const node of ordered) {
    if (!TEMPLATE_OUTCOMES.has(node.outcome)) continue
    const tool = (node.tool || '').trim()
    if (!tool) continue
    const action = (node.action || '').trim() || null
    const code = action ? `${tool}:${action}` : tool
    // 连续重复码（如审批通过前后对同一动作的重复记账）只保留一次。
    if (codes.length > 0 && codes[codes.length - 1] === code) continue
    codes.push(code)
    steps.push({ tool, action })
    if (typeof node.subject === 'string' && node.subject.trim()) {
      subjects.push(node.subject.trim())
    }
  }
  if (codes.length < minActions) return null

  return {
    ts: sequence.endedTs,
    sessionKey: sequence.sessionKey,
    category: intentCategory,
    action: intentAction,
    label: sequence.intentLabel ?? null,
    codes,
    steps,
    subjects,
  }
}

// ─── 结构相似度（LCS 覆盖率）──────────────────────────────────────────────

function lcsLength(a: Array<string>, b: Array<string>): number {
  const n = b.length
  let prev = new Array<number>(n + 1).fill(0)
  let curr = new Array<number>(n + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1] + 1
          : Math.max(prev[j], curr[j - 1])
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[n]
}

/** 两条结构签名的覆盖率：LCS 长度 / 较短者长度（0~1）。 */
function structureCoverage(a: Array<string>, b: Array<string>): number {
  const shorter = Math.min(a.length, b.length)
  if (shorter === 0) return 0
  return lcsLength(a, b) / shorter
}

// ─── 聚类与画像构建 ────────────────────────────────────────────────────────

function hashString(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(16)
}

interface ClusterOptions {
  mergeSimilarity: number
  minFrequency: number
  sampleLimit: number
}

/** 对同一任务族（意图锚点一致）的候选做「精确签名 → 相似合并」两级聚类。 */
function clusterPartition(
  candidates: Array<TaskCandidate>,
  options: ClusterOptions,
): Array<HighFrequencyTaskProfile> {
  // 1) 精确结构签名分桶（桶内按时间升序，代表体量最大的最典型模板）。
  const bucketsBySignature = new Map<string, Array<TaskCandidate>>()
  for (const cand of candidates) {
    const signature = cand.codes.join('>')
    let bucket = bucketsBySignature.get(signature)
    if (!bucket) {
      bucket = []
      bucketsBySignature.set(signature, bucket)
    }
    bucket.push(cand)
  }
  const buckets = Array.from(bucketsBySignature.values())
    // 桶按体量降序（体量相同时按最早出现升序），保证聚类确定性。
    .sort(
      (a, b) => b.length - a.length || a[0].ts - b[0].ts,
    )

  // 2) 结构相似度贪心合并：允许个别步骤浮动后仍归属同一模板。
  const clusters: Array<Array<TaskCandidate>> = []
  for (const bucket of buckets) {
    const bucketCodes = bucket[0].codes
    let target: Array<TaskCandidate> | null = null
    for (const cluster of clusters) {
      if (structureCoverage(cluster[0].codes, bucketCodes) >= options.mergeSimilarity) {
        target = cluster
        break
      }
    }
    if (target) {
      target.push(...bucket)
    } else {
      clusters.push(bucket.slice())
    }
  }

  const profiles: Array<HighFrequencyTaskProfile> = []
  for (const cluster of clusters) {
    const profile = buildProfile(cluster, options)
    if (profile) profiles.push(profile)
  }
  return profiles
}

function buildProfile(
  cluster: Array<TaskCandidate>,
  options: ClusterOptions,
): HighFrequencyTaskProfile | null {
  // 同一会话同一天内的重复执行视为一次习惯（防一次多文件分发式请求注水频次）。
  const seen = new Set<string>()
  const members: Array<TaskCandidate> = []
  for (const cand of cluster.slice().sort((a, b) => a.ts - b.ts)) {
    if (cand.sessionKey) {
      const day = Math.floor(cand.ts / DAY_MS)
      const key = `${cand.sessionKey}\u0000${day}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    members.push(cand)
  }
  if (members.length < options.minFrequency) return null

  // 步骤模板：取出现最多的结构签名；平手取最近一次执行。
  const signatureCount = new Map<string, number>()
  for (const m of members) {
    const signature = m.codes.join('>')
    signatureCount.set(signature, (signatureCount.get(signature) ?? 0) + 1)
  }
  const maxOccurrence = Math.max(...signatureCount.values())
  let template: TaskCandidate | null = null
  for (const m of members.slice().sort((a, b) => b.ts - a.ts)) {
    if (signatureCount.get(m.codes.join('>')) === maxOccurrence) {
      template = m
      break
    }
  }
  if (!template) return null

  // 参数样例：个人要素每个执行至多计一次，按出现次数降序截取。
  const parameterCount = new Map<string, number>()
  for (const m of members) {
    const unique = new Set(m.subjects)
    for (const value of unique) {
      parameterCount.set(value, (parameterCount.get(value) ?? 0) + 1)
    }
  }
  const parameterSamples = Array.from(parameterCount.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, options.sampleLimit)

  const firstTs = members[0].ts
  const lastTs = members[members.length - 1].ts
  const distinctDays = new Set(
    members.map((m) => Math.floor(m.ts / DAY_MS)),
  ).size

  const templateSignature = template.codes.join('>')
  return {
    taskId: `hf:${template.category}:${template.action}:${hashString(
      `${template.category}\u0000${template.action}\u0000${templateSignature}`,
    )}`,
    intentCategory: template.category,
    intentAction: template.action,
    intentLabel: template.label ?? members[members.length - 1].label,
    stepCount: template.steps.length,
    steps: template.steps,
    parameterSamples,
    occurrenceCount: members.length,
    distinctDays,
    firstTs,
    lastTs,
    isPeriodic: distinctDays >= 2,
  }
}

// ─── 识别入口 ──────────────────────────────────────────────────────────────

/**
 * 跨会话结构相似度聚类，识别高频任务画像（纯函数，无 IO）。
 *
 * 对传入序列（一般为单个档案的 agent 序列集合）执行：
 * 窗口过滤 → 候选构造 → 意图锚点分区 → 结构签名聚类 → 频次门槛 → 画像构建。
 * 结果按出现次数降序、最近执行降序排列，受 limit 截断。
 */
export function detectHighFrequencyTasks(
  sequences: ReadonlyArray<SessionRunSequence>,
  options: DetectHighFrequencyTasksOptions = {},
): Array<HighFrequencyTaskProfile> {
  const now = options.now ?? Date.now()
  const windowMs = options.windowMs ?? null
  const minFrequency = options.minFrequency ?? DEFAULT_MIN_FREQUENCY
  const minActions =
    options.minActionsPerSequence ?? DEFAULT_MIN_ACTIONS_PER_SEQUENCE
  const mergeSimilarity = options.mergeSimilarity ?? DEFAULT_MERGE_SIMILARITY
  const limit = options.limit ?? DEFAULT_HIGH_FREQUENCY_LIMIT
  const sampleLimit = options.sampleLimit ?? DEFAULT_SAMPLE_LIMIT

  const candidates: Array<TaskCandidate> = []
  for (const sequence of sequences) {
    if (windowMs !== null && sequence.endedTs < now - windowMs) continue
    const cand = buildCandidate(sequence, minActions)
    if (cand) candidates.push(cand)
  }

  // 意图锚点分区：跨类别/动作的任务族不做结构合并。
  const partitions = new Map<string, Array<TaskCandidate>>()
  for (const cand of candidates) {
    const key = `${cand.category}\u0000${cand.action}`
    let group = partitions.get(key)
    if (!group) {
      group = []
      partitions.set(key, group)
    }
    group.push(cand)
  }

  const clusterOptions: ClusterOptions = {
    mergeSimilarity,
    minFrequency,
    sampleLimit,
  }
  const profiles: Array<HighFrequencyTaskProfile> = []
  for (const group of partitions.values()) {
    profiles.push(...clusterPartition(group, clusterOptions))
  }

  return profiles
    .sort(
      (a, b) =>
        b.occurrenceCount - a.occurrenceCount || b.lastTs - a.lastTs,
    )
    .slice(0, limit)
}

// ─── 存储读取入口 ──────────────────────────────────────────────────────────

/**
 * 读取指定档案的高频任务画像（产品入口）。
 *
 * 从 habit-sequences 读取该档案的 agent 序列（读取上限取 MAX_SEQUENCES，
 * 与序列存储的容量收口上限一致，即读取全量），再走纯函数识别。默认观察
 * 窗口为最近 30 天；windowMs 传 null 可关闭窗口过滤（全量历史）。
 */
export function getHighFrequencyTasks(
  query: HighFrequencyTaskQuery = {},
): Array<HighFrequencyTaskProfile> {
  const profileName = query.profileName ?? 'default'
  // 产品默认 30 天窗口；仅显式传 null 才关闭（纯函数层默认不设窗口）。
  const windowMs =
    query.windowMs === undefined ? DEFAULT_HIGH_FREQUENCY_WINDOW_MS : query.windowMs
  const limit = query.limit ?? DEFAULT_HIGH_FREQUENCY_LIMIT

  const sequences = getHabitSequences({
    profileName,
    kind: 'agent',
    limit: MAX_SEQUENCES,
  })
  return detectHighFrequencyTasks(sequences, {
    windowMs: windowMs ?? null,
    limit,
  })
}
