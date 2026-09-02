import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { IntentCategory } from '@/utils/intent-classification'
import type {
  RunActionNode,
  SessionRunSequence,
} from '@/server/habit-sequences'
import {
  appendAgentSequence,
  clearHabitSequencesCache,
  configureHabitSequences,
  flushManualWindow,
  ingestManualDecision,
} from '@/server/habit-sequences'
import {
  detectHighFrequencyTasks,
  getHighFrequencyTasks,
} from '@/server/high-frequency-tasks'

const BASE_TS = 1_700_000_000_000
const DAY_MS = 24 * 60 * 60 * 1000

function node(
  order: number,
  tool: string,
  action: string | null = tool,
  outcome: RunActionNode['outcome'] = 'ok',
  subject: string | null = null,
): RunActionNode {
  return {
    ts: BASE_TS,
    order,
    tool,
    toolCallId: null,
    outcome,
    action,
    subject,
    summary: null,
  }
}

interface SeqSeed {
  endedTs: number
  sessionKey?: string | null
  category?: IntentCategory | null
  action?: string | null
  label?: string | null
  nodes?: Array<RunActionNode>
  kind?: SessionRunSequence['kind']
}

function agentSequence(seed: SeqSeed): SessionRunSequence {
  return {
    version: 1,
    sequenceId: `seq:${seed.endedTs}:${Math.random().toString(36).slice(2, 6)}`,
    kind: seed.kind ?? 'agent',
    profileName: 'default',
    sessionKey: seed.sessionKey ?? null,
    runId: null,
    intentLabel: seed.label ?? null,
    intentCategory: seed.category ?? null,
    intentAction: seed.action ?? null,
    startedTs: seed.endedTs - 10_000,
    endedTs: seed.endedTs,
    actions: seed.nodes ?? [],
  }
}

/**
 * 「整理报告」风格序列：读报告（个人要素=文件路径）→ 跑分析命令（通用）
 * → 写出总结。只有 read 步骤携带个人要素参数，贴近真实参数语义。
 */
function reportTaskSequence(
  index: number,
  options?: {
    sessionKey?: string
    ts?: number
    label?: string
    dropWriteStep?: boolean
    subject?: string
  },
): SessionRunSequence {
  const nodes = [
    node(0, 'files', 'read', 'ok', options?.subject ?? `C:\\docs\\r${index}.xlsx`),
    node(1, 'terminal', 'execute_shell'),
  ]
  if (!options?.dropWriteStep) {
    nodes.push(node(2, 'files', 'write'))
  }
  return agentSequence({
    endedTs: options?.ts ?? BASE_TS + index * DAY_MS,
    sessionKey: options?.sessionKey ?? `sess:report-${index}`,
    category: 'analysis',
    action: 'Summarize',
    label: options?.label ?? `整理报告 ${index}`,
    nodes,
  })
}

/** 「修复代码」风格序列（与「整理报告」构成不同任务族的对照）。 */
function fixTaskSequence(
  index: number,
  sessionKey: string,
  ts: number,
): SessionRunSequence {
  return agentSequence({
    endedTs: ts,
    sessionKey,
    category: 'coding',
    action: 'Fix',
    label: `修复问题 ${index}`,
    nodes: [
      node(0, 'files', 'read', 'ok', `C:\\src\\m${index}.ts`),
      node(1, 'terminal', 'execute_shell'),
    ],
  })
}

describe('high-frequency-tasks / 识别范围过滤', () => {
  it('excludes manual-window / chat / 空意图 / 无动作意图的序列', () => {
    const sequences = [
      // 手动窗口序列：无意图语义，不构成可重放任务
      agentSequence({
        endedTs: BASE_TS,
        kind: 'manual-window',
        sessionKey: null,
        category: null,
        nodes: [node(0, 'directory', 'read')],
      }),
      // chat 类别：闲聊带工具动作，不进任务画像
      agentSequence({
        endedTs: BASE_TS,
        sessionKey: 'sess:chat',
        category: 'chat',
        action: 'Discuss',
        nodes: [node(0, 'browser', 'navigate'), node(1, 'files', 'read')],
      }),
      // 空意图类别
      agentSequence({
        endedTs: BASE_TS,
        sessionKey: 'sess:null',
        category: null,
        action: null,
        nodes: [node(0, 'files', 'read'), node(1, 'files', 'write')],
      }),
      // 有意图但无动作（intentAction 缺失的历史数据）
      agentSequence({
        endedTs: BASE_TS,
        sessionKey: 'sess:noaction',
        category: 'analysis',
        action: null,
        nodes: [node(0, 'files', 'read'), node(1, 'files', 'write')],
      }),
    ]
    // 即便凑够数量也识别不出来
    expect(detectHighFrequencyTasks(sequences, { minFrequency: 1 })).toEqual([])
  })

  it('忽略成功步骤不足 minActions 的序列（错误/被拒分支不计入模板）', () => {
    const sequences = [
      // 仅 1 个成功步骤 + 2 个失败/被拒分支 -> 模板不足 2 步
      agentSequence({
        endedTs: BASE_TS,
        sessionKey: 'sess:sparse',
        category: 'analysis',
        action: 'Summarize',
        nodes: [
          node(0, 'files', 'read', 'ok', 'C:\\a.xlsx'),
          node(1, 'terminal', 'execute_shell', 'error'),
          node(2, 'browser', 'navigate', 'denied'),
        ],
      }),
      agentSequence({
        endedTs: BASE_TS + DAY_MS,
        sessionKey: 'sess:sparse-2',
        category: 'analysis',
        action: 'Summarize',
        nodes: [node(0, 'files', 'read', 'ok', 'C:\\b.xlsx')],
      }),
      agentSequence({
        endedTs: BASE_TS + 2 * DAY_MS,
        sessionKey: 'sess:sparse-3',
        category: 'analysis',
        action: 'Summarize',
        nodes: [node(0, 'files', 'read', 'ok', 'C:\\c.xlsx')],
      }),
    ]
    expect(detectHighFrequencyTasks(sequences)).toEqual([])
  })

  it('按观察窗口过滤序列（超窗不参与识别）', () => {
    const now = BASE_TS + 5 * DAY_MS
    const sequences = reportTaskSequence(0, { sessionKey: 'sess:w0' })
    const sequencesList = [
      sequences,
      reportTaskSequence(1, {
        sessionKey: 'sess:w1',
        ts: now,
      }),
      reportTaskSequence(2, {
        sessionKey: 'sess:w2',
        ts: now - 2 * DAY_MS,
      }),
    ]
    // 窗口只覆盖最近 1 天：仅 1 条在窗内 -> 不足频次门槛
    expect(
      detectHighFrequencyTasks(sequencesList, { now, windowMs: DAY_MS }),
    ).toEqual([])
    // 关闭窗口（null）后三条都在 -> 识别出 1 个任务
    const all = detectHighFrequencyTasks(sequencesList, {
      now,
      windowMs: null,
    })
    expect(all).toHaveLength(1)
    expect(all[0].occurrenceCount).toBe(3)
  })
})

describe('high-frequency-tasks / 结构相似度聚类', () => {
  it('同任务跨会话跨天聚类，产出完整画像（含周期标记）', () => {
    const sequences = [
      reportTaskSequence(0, {
        sessionKey: 'sess:r0',
        ts: BASE_TS,
        label: '整理报告 A',
        subject: 'C:\\docs\\r0.xlsx',
      }),
      reportTaskSequence(1, {
        sessionKey: 'sess:r1',
        ts: BASE_TS + DAY_MS,
        label: '整理报告 B',
        subject: 'C:\\docs\\r1.xlsx',
      }),
      reportTaskSequence(2, {
        sessionKey: 'sess:r2',
        ts: BASE_TS + 2 * DAY_MS,
        label: '整理报告 C',
        subject: 'C:\\docs\\r2.xlsx',
      }),
    ]

    const [profile] = detectHighFrequencyTasks(sequences, { windowMs: null })
    expect(profile).toBeDefined()
    expect(profile.intentCategory).toBe('analysis')
    expect(profile.intentAction).toBe('Summarize')
    // 步骤模板取最近一次执行的最典型签名
    expect(profile.intentLabel).toBe('整理报告 C')
    expect(profile.stepCount).toBe(3)
    expect(profile.steps.map((step) => step.tool)).toEqual([
      'files',
      'terminal',
      'files',
    ])
    // 参数样例：三份文档各出现一次
    expect(profile.parameterSamples).toHaveLength(3)
    expect(profile.parameterSamples.map((sample) => sample.count)).toEqual([
      1, 1, 1,
    ])
    // 频次 / 周期
    expect(profile.occurrenceCount).toBe(3)
    expect(profile.distinctDays).toBe(3)
    expect(profile.isPeriodic).toBe(true)
    expect(profile.firstTs).toBe(BASE_TS)
    expect(profile.lastTs).toBe(BASE_TS + 2 * DAY_MS)

    // taskId 确定：两次识别结果一致
    const again = detectHighFrequencyTasks(sequences, { windowMs: null })
    expect(again[0].taskId).toBe(profile.taskId)
    expect(profile.taskId).toMatch(/^hf:analysis:Summarize:[0-9a-f]+$/)
  })

  it('结构近似（缺一步 / 多一步）经 LCS 覆盖率合并为同一模板', () => {
    const sequences = [
      reportTaskSequence(0, {
        sessionKey: 'sess:m0',
        ts: BASE_TS,
        label: '完整执行',
      }),
      reportTaskSequence(1, {
        sessionKey: 'sess:m1',
        ts: BASE_TS + DAY_MS,
        label: '少写出一总结',
        dropWriteStep: true,
      }),
      reportTaskSequence(2, {
        sessionKey: 'sess:m2',
        ts: BASE_TS + 2 * DAY_MS,
        label: '完整执行',
      }),
    ]
    const [profile] = detectHighFrequencyTasks(sequences, { windowMs: null })
    expect(profile).toBeDefined()
    expect(profile.occurrenceCount).toBe(3)
    // 出现 2 次的 3 步模板胜出；2 步的浮动模板并入同一任务族
    expect(profile.stepCount).toBe(3)
  })

  it('出现次数低于 minFrequency 不产出任务', () => {
    const sequences = [
      reportTaskSequence(0, { sessionKey: 'sess:l0', ts: BASE_TS }),
      reportTaskSequence(1, {
        sessionKey: 'sess:l1',
        ts: BASE_TS + DAY_MS,
      }),
    ]
    expect(detectHighFrequencyTasks(sequences, { windowMs: null })).toEqual([])
    // 调低门槛后可见
    const low = detectHighFrequencyTasks(sequences, {
      windowMs: null,
      minFrequency: 2,
    })
    expect(low).toHaveLength(1)
    expect(low[0].occurrenceCount).toBe(2)
  })

  it('同一会话同一天内的重复执行只计一次（防注水）', () => {
    // sess:inflate 同一天 5 次执行 -> 计 1
    const inflated = Array.from({ length: 5 }, (_, i) =>
      reportTaskSequence(i, {
        sessionKey: 'sess:inflate',
        ts: BASE_TS + i * 60_000,
      }),
    )
    const others = [
      reportTaskSequence(10, {
        sessionKey: 'sess:other-b',
        ts: BASE_TS + DAY_MS,
      }),
      reportTaskSequence(11, {
        sessionKey: 'sess:other-c',
        ts: BASE_TS + 2 * DAY_MS,
      }),
    ]
    const [profile] = detectHighFrequencyTasks(
      [...inflated, ...others],
      { windowMs: null },
    )
    expect(profile.occurrenceCount).toBe(3)
    expect(profile.distinctDays).toBe(3)
  })

  it('全部集中在同一自然日 -> 非周期但仍属高频', () => {
    const sequences = Array.from({ length: 3 }, (_, i) =>
      reportTaskSequence(i, {
        sessionKey: `sess:oneday-${i}`,
        ts: BASE_TS + i * 60_000,
      }),
    )
    const [profile] = detectHighFrequencyTasks(sequences, { windowMs: null })
    expect(profile.occurrenceCount).toBe(3)
    expect(profile.distinctDays).toBe(1)
    expect(profile.isPeriodic).toBe(false)
  })
})

describe('high-frequency-tasks / 结果排序与限制', () => {
  it('多任务按出现次数降序、最近执行降序，受 limit 截断', () => {
    // taskA（整理报告）：3 次，最近在第 2 天；taskB（修复代码）：3 次，最近在第 5 天
    const taskA = [
      reportTaskSequence(0, { sessionKey: 'sess:a0', ts: BASE_TS }),
      reportTaskSequence(1, {
        sessionKey: 'sess:a1',
        ts: BASE_TS + DAY_MS,
      }),
      reportTaskSequence(2, {
        sessionKey: 'sess:a2',
        ts: BASE_TS + 2 * DAY_MS,
      }),
    ]
    const taskB = [
      fixTaskSequence(0, 'sess:b0', BASE_TS + 3 * DAY_MS),
      fixTaskSequence(1, 'sess:b1', BASE_TS + 4 * DAY_MS),
      fixTaskSequence(2, 'sess:b2', BASE_TS + 5 * DAY_MS),
    ]

    const results = detectHighFrequencyTasks([...taskA, ...taskB], {
      windowMs: null,
    })
    expect(results).toHaveLength(2)
    expect(results[0].intentCategory).toBe('coding') // taskB 最近
    expect(results[0].lastTs).toBe(BASE_TS + 5 * DAY_MS)
    expect(results[1].intentCategory).toBe('analysis')

    const limited = detectHighFrequencyTasks([...taskA, ...taskB], {
      windowMs: null,
      limit: 1,
    })
    expect(limited).toHaveLength(1)
    expect(limited[0].intentCategory).toBe('coding')
    expect(limited[0].lastTs).toBe(BASE_TS + 5 * DAY_MS)
  })
})

describe('high-frequency-tasks / 参数样例聚合', () => {
  it('每个执行内同一参数只计一次，按出现次数降序截取', () => {
    const sequences = [
      reportTaskSequence(0, {
        sessionKey: 'sess:p0',
        ts: BASE_TS,
        subject: 'C:\\docs\\A.xlsx',
      }),
      reportTaskSequence(1, {
        sessionKey: 'sess:p1',
        ts: BASE_TS + DAY_MS,
        subject: 'C:\\docs\\A.xlsx',
      }),
      reportTaskSequence(2, {
        sessionKey: 'sess:p2',
        ts: BASE_TS + 2 * DAY_MS,
        subject: 'C:\\docs\\B.xlsx',
      }),
    ]
    const [profile] = detectHighFrequencyTasks(sequences, { windowMs: null })
    // A 出现 2 次，B 出现 1 次
    expect(profile.parameterSamples[0]).toEqual({
      value: 'C:\\docs\\A.xlsx',
      count: 2,
    })
    expect(profile.parameterSamples[1]).toEqual({
      value: 'C:\\docs\\B.xlsx',
      count: 1,
    })
  })
})

describe('high-frequency-tasks / 存储入口 getHighFrequencyTasks', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hft-test-'))
    configureHabitSequences({ storeDir: tempDir })
    clearHabitSequencesCache()
  })

  afterEach(() => {
    clearHabitSequencesCache()
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('只读取 agent 序列，手动窗口序列不进任务画像', () => {
    const recentTs = Date.now() - 5_000
    for (let i = 0; i < 3; i += 1) {
      appendAgentSequence({
        profileName: 'default',
        sessionKey: `sess:store-${i}`,
        runId: `run:store-${i}`,
        intentLabel: `整理报告 ${i}`,
        intentCategory: 'analysis',
        intentAction: 'Summarize',
        startedTs: recentTs,
        endedTs: recentTs + i * 10,
        actions: [
          node(0, 'files', 'read', 'ok', `C:\\docs\\r${i}.xlsx`),
          node(1, 'terminal', 'execute_shell', 'ok', 'ls'),
          node(2, 'files', 'write', 'ok', `C:\\out\\s${i}.md`),
        ],
      })
    }
    // 手动链路序列也写进同一档案存储
    for (let i = 0; i < 3; i += 1) {
      ingestManualDecision({
        source: 'directory',
        result: 'allowed',
        action: 'read',
        subject: 'D:\\docs',
        reason: 'test',
        profileName: null,
        ts: recentTs + i * 500,
        details: {},
      })
    }
    flushManualWindow()

    // 手动窗口序列真实落盘了
    expect(fs.existsSync(path.join(tempDir, 'profile.json'))).toBe(true)

    // 但高频任务识别只消费 agent 序列
    const tasks = getHighFrequencyTasks({
      profileName: 'default',
      windowMs: null,
    })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].intentCategory).toBe('analysis')
    expect(tasks[0].occurrenceCount).toBe(3)
  })

  it('产品默认观察窗口为最近 30 天（超窗历史习惯不暴露）', () => {
    // 30 天前完成 3 次的旧习惯：应被默认窗口过滤
    const oldTs = Date.now() - 31 * DAY_MS
    for (let i = 0; i < 3; i += 1) {
      appendAgentSequence({
        profileName: 'default',
        sessionKey: `sess:old-${i}`,
        runId: `run:old-${i}`,
        intentLabel: `旧任务 ${i}`,
        intentCategory: 'coding',
        intentAction: 'Fix',
        startedTs: oldTs,
        endedTs: oldTs + i * 10,
        actions: [
          node(0, 'files', 'read', 'ok'),
          node(1, 'terminal', 'execute_shell', 'ok'),
        ],
      })
    }
    expect(getHighFrequencyTasks({ profileName: 'default' })).toEqual([])
    // 显式关闭窗口后可见
    const tasks = getHighFrequencyTasks({
      profileName: 'default',
      windowMs: null,
    })
    expect(tasks).toHaveLength(1)
    expect(tasks[0].occurrenceCount).toBe(3)
  })
})
