/**
 * 执行账本数据层（Run Ledger Store）
 *
 * 会话页右区「执行账本」的前端运行视图模型。首期只做「前台对话式业务编排」的会话内
 * Run：账本消费 send-stream 链路已结构化的 tool 事件（phase/name/toolCallId/args/
 * result/runId/sessionKey），按 sessionKey 收账「当前一次 Run」，不做新增后端存储、
 * 不改写服务端沉淀链路（agent-run-sediment 保持只读观测纪律）。
 *
 * 语义约定：
 * - 每个 sessionKey 只保留最近一次 Run（发送受理即视为新 Run 开启，旧 Run 被顶替）。
 * - 工具动作被翻译为办公语义（label + subject），工程细节（toolName/summary）仅在
 *   动作明细展开时呈现，默认态只回答「正在做什么 / 对象是谁」。
 * - 终态转换在事件流侧完成：成功（finishStream）→ completeRun；失败（markFailed）
 *   → failRun；重复终态信号幂等，不会二次覆盖。
 */
import { create } from 'zustand'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type LedgerRunStatus = 'active' | 'complete' | 'error'

export type LedgerNodeStatus = 'running' | 'success' | 'error'

/** 工具的业务归类，用于语义翻译与图标呈现 */
export type LedgerToolKind =
  | 'search'
  | 'read'
  | 'write'
  | 'edit'
  | 'browser'
  | 'command'
  | 'memory'
  | 'approval'
  | 'other'

/** 账本只关心三种传输层相位：start=开始、complete=完成、error=失败 */
export type LedgerToolPhase = 'start' | 'complete' | 'error'

export interface LedgerNode {
  /** 节点唯一键：优先取 toolCallId（start/complete/error 三态复用同一条） */
  key: string
  ts: number
  kind: LedgerToolKind
  toolName: string
  phase: LedgerToolPhase
  status: LedgerNodeStatus
  /** 业务语义文案，如「正在检索资料」「文件已生成」 */
  label: string
  /** 业务主体：文件路径（取文件名）或检索词 / 链接等 */
  subject?: string
  /** 产物文件完整路径（write/read/edit 类且 args 含真实路径时保留，供「打开预览」直通） */
  filePath?: string
  /** 完成/失败时的结果摘要（来自服务端 result 预览），仅在明细展开时显示 */
  summary?: string
  toolCallId?: string
  runId?: string
}

export interface LedgerRun {
  sessionKey: string
  runId: string | null
  status: LedgerRunStatus
  /** 任务标题：取自用户发送消息的业务摘要 */
  title: string
  startedAt: number
  updatedAt: number
  completedAt?: number
  /** 失败原因（failRun 时写入，展示在任务头） */
  errorMessage?: string
  nodes: Array<LedgerNode>
}

/** 传输层传入的原始 tool 事件（宽松字段，store 侧负责归一化） */
export interface LedgerToolEvent {
  /** 归一化前的原始相位：start/calling/running/complete/error 均可 */
  phase: string
  name: string
  toolCallId?: string
  args?: unknown
  /** 完成预览；未提供时退回 result */
  result?: string
  preview?: string
  runId?: string | null
}

interface RunLedgerState {
  /** 按 sessionKey 收账最近一次 Run（尚未开启过的会话在索引中缺省） */
  runs: Record<string, LedgerRun | undefined>
  /** 发送受理即开启新 Run（同一会话再次发送会顶替旧 Run） */
  openRun: (
    sessionKey: string,
    opts: { title: string; runId?: string | null },
  ) => void
  /** started 事件到达后补挂 runId */
  attachRunId: (sessionKey: string, runId: string | null) => void
  /** 追加 / 更新一个工具节点（按 toolCallId 收敛三态） */
  appendTool: (sessionKey: string, event: LedgerToolEvent) => void
  /** 成功终态：落定任务，运行中的节点统一收敛为成功 */
  completeRun: (sessionKey: string) => void
  /** 失败终态：记录原因；运行中的节点保持原状，面板以「中断」语义呈现 */
  failRun: (sessionKey: string, message: string) => void
}

// ── 语义翻译（工具名 → 业务归类 / 业务文案）─────────────────────────────────────

/** 工具名归类：决定默认呈现的办公语义 */
export function classifyTool(toolName: string): LedgerToolKind {
  const name = toolName.trim().toLowerCase()
  if (/^(web_search|search|duckduckgo_search|baidu_search)$/.test(name))
    return 'search'
  if (/^(search_files|grep_search|grep)$/.test(name)) return 'read'
  if (
    /^(write_file|create_file|overwrite_file|write)$/.test(name)
  )
    return 'write'
  // 产物（artifact）事件：按「生成文件」语义归类，使其完整路径可直通预览
  if (/^artifact/i.test(name)) return 'write'
  if (
    /^(edit|apply_patch|str_replace_editor|Edit|modify_file|update_file)$/.test(
      name,
    )
  )
    return 'edit'
  if (
    /^(read_file|read|view_file|list_files|directory_tree|file_tool)$/.test(
      name,
    )
  )
    return 'read'
  if (/browser|open_webpage|navigate|http|fetch|visit_|screenshot/.test(name))
    return 'browser'
  if (/^(shell|command|run_command|execute_command|terminal|cmd|powershell|run)$/.test(name))
    return 'command'
  if (/memory|remember|recall|save_memory|note_/.test(name)) return 'memory'
  if (/approval|request_approval|risk_confirm/.test(name)) return 'approval'
  return 'other'
}

const KIND_LABELS: Record<
  LedgerToolKind,
  { start: string; ok: string; fail: string }
> = {
  search: { start: '正在检索资料', ok: '检索资料完成', fail: '检索资料失败' },
  read: { start: '正在读取文件', ok: '读取文件完成', fail: '读取文件失败' },
  write: { start: '正在生成文件', ok: '文件已生成', fail: '文件生成失败' },
  edit: { start: '正在修改文件', ok: '文件已修改', fail: '文件修改失败' },
  browser: {
    start: '正在打开网页核对',
    ok: '网页核对完成',
    fail: '网页核对失败',
  },
  command: {
    start: '正在后台执行操作',
    ok: '后台操作完成',
    fail: '后台操作失败',
  },
  memory: { start: '正在更新记忆', ok: '记忆已更新', fail: '记忆更新失败' },
  approval: { start: '需要你确认', ok: '已确认', fail: '已拒绝' },
  other: { start: '', ok: '', fail: '' },
}

function labelFor(
  kind: LedgerToolKind,
  status: LedgerNodeStatus,
  toolName: string,
): string {
  const table = KIND_LABELS[kind]
  if (kind === 'other' || !table.start) return toolName || '工具执行'
  if (status === 'running') return table.start
  if (status === 'success') return table.ok
  return table.fail
}

// ── 主体（subject）提取 ─────────────────────────────────────────────────────────

/** 从 args 中提取业务主体（优先文件路径/链接/检索词，排除大段内容字段） */
export function extractSubject(args: unknown, kind: LedgerToolKind): string | undefined {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return undefined
  }
  const record = args as Record<string, unknown>
  const keys: Array<keyof typeof record> = [
    'path',
    'file_path',
    'filename',
    'file',
    'target',
    'document',
    'url',
    'link',
    'query',
    'keyword',
    'keywords',
  ]
  for (const key of keys) {
    const raw = record[key]
    if (typeof raw === 'string' && raw.trim()) return normalizeSubject(raw, kind)
    if (Array.isArray(raw) && raw.length > 0) {
      const joined = raw
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .join('、')
      if (joined) return normalizeSubject(joined, kind)
    }
  }
  return undefined
}

function normalizeSubject(raw: string, kind: LedgerToolKind): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 120)
  // 文件类动作只展示文件名，避免长路径噪音
  if (kind === 'read' || kind === 'write' || kind === 'edit') {
    const segments = trimmed.split(/[\\/]/)
    return segments[segments.length - 1]?.slice(0, 60) ?? trimmed
  }
  return trimmed.slice(0, 48)
}

/**
 * 从 args 中提取产物文件完整路径（仅文件类动作）。路径型字段的值必须像真实路径
 * （含目录分隔符或文件扩展名），避免把 query/keyword 等内容误当文件，供面板「打开预览」使用。
 */
export function extractFilePath(
  args: unknown,
  kind: LedgerToolKind,
): string | undefined {
  if (kind !== 'read' && kind !== 'write' && kind !== 'edit') return undefined
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return undefined
  }
  const record = args as Record<string, unknown>
  const pathKeys = ['path', 'file_path', 'filename', 'file', 'target'] as const
  for (const key of pathKeys) {
    const raw = record[key]
    if (typeof raw !== 'string') continue
    const value = raw.trim().replace(/\s+/g, ' ')
    if (!value || value.length > 700) continue
    // 仅接受含目录分隔符或带扩展名的路径，排除纯文本描述字段
    if (/[\\/]/.test(value) || /\.[A-Za-z0-9]{1,10}$/.test(value)) {
      return value
    }
  }
  return undefined
}

// ── 任务标题 ────────────────────────────────────────────────────────────────────

/** 从用户发送内容生成账本任务标题（业务摘要，不含工程细节） */
export function deriveRunTitle(message: string): string {
  const text = message.trim()
  if (!text) return '任务执行'
  const firstLine = text.split('\n')[0].trim()
  const cleaned = firstLine
    .replace(/^[#>*\-~\s]+/, '')
    .replace(/[*_`]/g, '')
    .trim()
  return (cleaned || '任务执行').slice(0, 48)
}

// ── 内部工具 ────────────────────────────────────────────────────────────────────

function now(): number {
  return Date.now()
}

function normalizePhase(raw: string): LedgerToolPhase {
  const phase = raw.toLowerCase()
  if (phase === 'complete' || phase === 'done' || phase === 'success')
    return 'complete'
  if (phase === 'error' || phase === 'failed') return 'error'
  return 'start'
}

function settleRunningNodes(run: LedgerRun): LedgerRun {
  const settled = run.nodes.map((node) =>
    node.status === 'running' ? { ...node, status: 'success' as const } : node,
  )
  return { ...run, nodes: settled }
}

function makeNode(event: LedgerToolEvent, ts: number, runId: string | null): LedgerNode {
  const toolName = event.name.trim() || '工具执行'
  const phase = normalizePhase(event.phase)
  const status: LedgerNodeStatus =
    phase === 'complete' ? 'success' : phase === 'error' ? 'error' : 'running'
  const kind = classifyTool(toolName)
  const subject = extractSubject(event.args, kind)
  const filePath = extractFilePath(event.args, kind)
  const rawSummary = event.result ?? event.preview
  const summary =
    typeof rawSummary === 'string' && rawSummary.trim()
      ? rawSummary.trim().replace(/\s+/g, ' ').slice(0, 240)
      : undefined
  return {
    key:
      event.toolCallId?.trim() ||
      `${toolName}-${ts}-${Math.random().toString(36).slice(2, 7)}`,
    ts,
    kind,
    toolName,
    phase,
    status,
    label: labelFor(kind, status, toolName),
    subject,
    filePath,
    summary,
    toolCallId: event.toolCallId,
    runId: runId ?? event.runId ?? undefined,
  }
}

// ── Store ───────────────────────────────────────────────────────────────────────

export const useRunLedgerStore = create<RunLedgerState>((set, get) => ({
  runs: {},

  openRun: (sessionKey, { title, runId }) =>
    set((state) => ({
      runs: {
        ...state.runs,
        [sessionKey]: {
          sessionKey,
          runId: typeof runId === 'string' && runId.trim() ? runId : null,
          status: 'active',
          title: title.trim() ? title.trim() : '任务执行',
          startedAt: now(),
          updatedAt: now(),
          nodes: [],
        },
      },
    })),

  attachRunId: (sessionKey, runId) =>
    set((state) => {
      const run = state.runs[sessionKey]
      if (!run || run.status !== 'active') return state
      const nextRunId =
        typeof runId === 'string' && runId.trim() ? runId : run.runId
      if (nextRunId === run.runId) return state
      return {
        runs: {
          ...state.runs,
          [sessionKey]: { ...run, runId: nextRunId, updatedAt: now() },
        },
      }
    }),

  appendTool: (sessionKey, event) =>
    set((state) => {
      const run = state.runs[sessionKey]
      // 无进行中 Run（例如事件晚于终态到达 / 会话已切走）直接丢弃
      if (!run || run.status !== 'active') return state
      const eventRunId = typeof event.runId === 'string' ? event.runId : null
      // 旧 Run 的迟到事件（runId 不一致）丢弃，避免污染新一轮账本
      if (run.runId && eventRunId && run.runId !== eventRunId) return state

      const ts = now()
      const candidate = makeNode(event, ts, run.runId)
      const existingIndex = candidate.toolCallId
        ? run.nodes.findIndex((n) => n.toolCallId === candidate.toolCallId)
        : -1

      let nodes: Array<LedgerNode>
      if (existingIndex >= 0) {
        // start → complete / error 三态收敛到同一条节点
        const prev = run.nodes[existingIndex]
        const phase = normalizePhase(event.phase)
        const status: LedgerNodeStatus =
          phase === 'error' ? 'error' : phase === 'complete' ? 'success' : prev.status
        nodes = run.nodes.map((node, index) =>
          index === existingIndex
            ? {
                ...node,
                phase,
                status,
                ts,
                label: labelFor(node.kind, status, node.toolName),
                summary: candidate.summary ?? node.summary,
                subject: candidate.subject ?? node.subject,
                filePath: candidate.filePath ?? node.filePath,
                updatedAt: ts,
              }
            : node,
        )
      } else {
        nodes = [...run.nodes, candidate]
      }
      return {
        runs: {
          ...state.runs,
          [sessionKey]: { ...run, nodes, updatedAt: ts },
        },
      }
    }),

  completeRun: (sessionKey) =>
    set((state) => {
      const run = state.runs[sessionKey]
      if (!run || run.status !== 'active') return state
      const completedAt = now()
      return {
        runs: {
          ...state.runs,
          [sessionKey]: {
            ...settleRunningNodes(run),
            status: 'complete',
            updatedAt: completedAt,
            completedAt,
          },
        },
      }
    }),

  failRun: (sessionKey, message) =>
    set((state) => {
      const run = state.runs[sessionKey]
      if (!run || run.status !== 'active') return state
      const completedAt = now()
      return {
        runs: {
          ...state.runs,
          [sessionKey]: {
            ...run,
            status: 'error',
            errorMessage:
              typeof message === 'string' && message.trim()
                ? message.trim().slice(0, 160)
                : '执行中断',
            updatedAt: completedAt,
            completedAt,
          },
        },
      }
    }),
}))
