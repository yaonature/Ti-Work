/**
 * Agent 会话链路行为追踪（P1-A 主线 — send-stream 接线层）。
 *
 * 在 send-stream 的 SSE onEvent 之上按 runId 聚合一次 Agent run 内真实落地的
 * 有序工具动作；run.completed 时将整段 run 收口为一条「会话任务序列」落盘
 * （appendAgentSequence → habit-sequences），供高频任务识别（P1-B）与后续
 * OPC 提纯消费。
 *
 * 观测纪律（与方案文档 4.5.1 对齐）：
 *  - 纯只读：不改事件流、不阻塞、不抛错；
 *  - 只收「真实落地」节点：tool.completed / tool.failed / artifact.created /
 *    approval.required；纯文本回复（无任何工具动作）的 run 自然忽略；
 *  - run 以 error / 超时中断时由调用方 discardRun 丢弃，避免半截序列入库存量；
 *  - 内存轨迹按 runId 隔离，容量 + TTL 双层防护，杜绝泄漏。
 */
import type { ClassifiedIntent } from '../utils/intent-classification'
import type { RunActionNode } from './habit-sequences'
import { appendAgentSequence } from './habit-sequences'

const DEFAULT_MAX_TRACES = 48
const DEFAULT_TRACE_TTL_MS = 20 * 60 * 1000
const SUBJECT_MAX_LENGTH = 240
const SUMMARY_MAX_LENGTH = 400
/** 内部占位类工具名不沉淀（推理进度、通用回退名）。 */
const IGNORED_TOOL_NAMES = new Set(['_thinking', 'tool'])

interface RunTrace {
  runId: string
  sessionKey: string | null
  profileName: string | null
  intent: ClassifiedIntent | null
  startedTs: number
  nodes: Array<RunActionNode>
}

const traces = new Map<string, RunTrace>()

let maxTraces = DEFAULT_MAX_TRACES
let traceTtlMs = DEFAULT_TRACE_TTL_MS

/** 覆盖容量与 TTL 上限（供测试改写，避免触碰生产默认值）。 */
export function configureAgentSediment(options?: {
  maxTraces?: number
  traceTtlMs?: number
}): void {
  if (options?.maxTraces !== undefined) {
    maxTraces = Math.max(2, options.maxTraces)
  }
  if (options?.traceTtlMs !== undefined) {
    traceTtlMs = Math.max(1_000, options.traceTtlMs)
  }
}

/** 丢弃全部内存轨迹（测试隔离用）。 */
export function clearAgentSedimentTraces(): void {
  traces.clear()
}

function purgeExpired(): void {
  const now = Date.now()
  for (const [runId, trace] of traces) {
    if (now - trace.startedTs > traceTtlMs) {
      traces.delete(runId)
    }
  }
}

function evictOldestIfNeeded(): void {
  if (traces.size < maxTraces) return
  let oldestRunId: string | null = null
  let oldestTs = Infinity
  for (const [runId, trace] of traces) {
    if (trace.startedTs < oldestTs) {
      oldestTs = trace.startedTs
      oldestRunId = runId
    }
  }
  if (oldestRunId) traces.delete(oldestRunId)
}

/**
 * 开启一次 run 的链路追踪（幂等）。send-stream 在首个携带 run_id 的事件上
 * 调用；同一 run 的后续工具事件只做追加，不重复开启。
 */
export function noteRunStarted(input: {
  runId: string
  sessionKey: string | null
  profileName?: string | null
  intent: ClassifiedIntent | null
  startedTs?: number
}): void {
  if (!input.runId || traces.has(input.runId)) return
  purgeExpired()
  evictOldestIfNeeded()
  traces.set(input.runId, {
    runId: input.runId,
    sessionKey: input.sessionKey,
    profileName: input.profileName ?? null,
    intent: input.intent,
    startedTs: input.startedTs ?? Date.now(),
    nodes: [],
  })
}

function getTrace(runId: string): RunTrace | undefined {
  return traces.get(runId)
}

function truncate(
  text: string | null | undefined,
  maxLength: number,
): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null
  return trimmed.length <= maxLength ? trimmed : trimmed.slice(0, maxLength)
}

const SUBJECT_ARG_KEYS = [
  'command',
  'cmd',
  'path',
  'file_path',
  'filePath',
  'url',
  'target',
  'repo',
  'query',
  'prompt',
]

/** 从工具参数中提炼可读主体（命令/路径/域名原文），本地保留、上云剥离。 */
function pickSubject(args: unknown): string | null {
  if (typeof args === 'string') {
    return truncate(args, SUBJECT_MAX_LENGTH)
  }
  if (args && typeof args === 'object') {
    const record = args as Record<string, unknown>
    for (const key of SUBJECT_ARG_KEYS) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) {
        return truncate(value, SUBJECT_MAX_LENGTH)
      }
    }
    try {
      const serialized = JSON.stringify(args)
      if (serialized && serialized.length > 2) {
        return truncate(serialized, SUBJECT_MAX_LENGTH)
      }
    } catch {
      // 不可序列化的参数忽略主体
    }
  }
  return null
}

function appendNode(
  runId: string,
  input: {
    ts?: number
    tool: string
    toolCallId: string | null
    outcome: RunActionNode['outcome']
    action?: string | null
    subject?: string | null
    summary?: string | null
  },
): void {
  const trace = getTrace(runId)
  if (!trace || IGNORED_TOOL_NAMES.has(input.tool)) return
  trace.nodes.push({
    ts: input.ts ?? Date.now(),
    order: trace.nodes.length,
    tool: input.tool,
    toolCallId: input.toolCallId,
    outcome: input.outcome,
    action: input.action ?? null,
    subject: truncate(input.subject ?? null, SUBJECT_MAX_LENGTH),
    summary: truncate(input.summary ?? null, SUMMARY_MAX_LENGTH),
  })
}

/** 工具成功完成（outcome=ok）。 */
export function noteToolCompleted(
  runId: string,
  input: {
    toolName: string
    toolCallId: string | null
    args?: unknown
    summary?: string | null
    ts?: number
  },
): void {
  appendNode(runId, {
    ts: input.ts,
    tool: input.toolName,
    toolCallId: input.toolCallId,
    outcome: 'ok',
    subject: pickSubject(input.args),
    summary: input.summary ?? null,
  })
}

/** 工具执行失败（outcome=error）。 */
export function noteToolFailed(
  runId: string,
  input: {
    toolName: string
    toolCallId: string | null
    args?: unknown
    summary?: string | null
    ts?: number
  },
): void {
  appendNode(runId, {
    ts: input.ts,
    tool: input.toolName,
    toolCallId: input.toolCallId,
    outcome: 'error',
    subject: pickSubject(input.args),
    summary: input.summary ?? null,
  })
}

/** 产物落成（outcome=ok），subject 取产物路径/标题。 */
export function noteArtifactCreated(
  runId: string,
  input: {
    toolName: string
    subject?: string | null
    summary?: string | null
    ts?: number
  },
): void {
  appendNode(runId, {
    ts: input.ts,
    tool: input.toolName,
    toolCallId: null,
    outcome: 'ok',
    subject: input.subject ?? null,
    summary: input.summary ?? null,
  })
}

/** Agent 触发风险审批（outcome=pending_approval），记录动作与上下文。 */
export function noteApprovalRequired(
  runId: string,
  input: {
    action?: string | null
    context?: string | null
    ts?: number
  },
): void {
  appendNode(runId, {
    ts: input.ts,
    tool: 'approval',
    toolCallId: null,
    outcome: 'pending_approval',
    action: input.action ?? null,
    subject: input.context ?? null,
  })
}

/**
 * run 正常收口：将整段轨迹固化为一条 agent 会话任务序列落盘并释放内存。
 * 无任何工具动作的 run 返回 null 且不产生序列（appendAgentSequence 语义）。
 */
export function noteRunEnded(runId: string): string | null {
  const trace = getTrace(runId)
  if (!trace) return null
  traces.delete(runId)
  return appendAgentSequence({
    profileName: trace.profileName,
    sessionKey: trace.sessionKey,
    runId: trace.runId,
    intentLabel: trace.intent?.label ?? null,
    intentCategory: trace.intent?.category ?? null,
    intentAction: trace.intent?.action ?? null,
    startedTs: trace.startedTs,
    endedTs: Date.now(),
    actions: trace.nodes,
  })
}

/** 中断丢弃：run 以 error / 超时结束时丢弃半截轨迹，不产生不完整序列。 */
export function discardRun(runId: string): void {
  if (!runId) return
  traces.delete(runId)
}
