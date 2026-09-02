import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { UnifiedPolicyDecision } from '@/server/policy-telemetry'
import type { RunActionNode } from '@/server/habit-sequences'
import {
  appendAgentSequence,
  clearHabitSequencesCache,
  configureHabitSequences,
  flushManualWindow,
  getHabitSequences,
  ingestManualDecision,
  resetHabitSequences,
} from '@/server/habit-sequences'

const BASE_TS = 1_700_000_000_000

function decision(
  partial: Pick<UnifiedPolicyDecision, 'source' | 'result' | 'ts'> &
    Partial<Omit<UnifiedPolicyDecision, 'source' | 'result' | 'ts'>>,
): UnifiedPolicyDecision {
  return {
    action: 'list',
    subject: null,
    reason: 'test',
    profileName: null,
    details: {},
    ...partial,
  }
}

function manualDecision(
  source: 'directory' | 'website' | 'terminal',
  result: 'allowed' | 'denied' | 'needs_approval' | 'needs_confirmation',
  ts: number,
  extras?: Partial<UnifiedPolicyDecision>,
): UnifiedPolicyDecision {
  return decision({ source, result, ts, action: 'read', subject: 'subject', ...extras })
}

function actionNode(partial: Partial<RunActionNode> & { order: number }): RunActionNode {
  return {
    ts: BASE_TS,
    tool: 'shell',
    toolCallId: null,
    outcome: 'ok',
    action: 'execute_shell',
    subject: null,
    summary: null,
    ...partial,
  }
}

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'habit-seq-test-'))
  // 测试隔离：窗口间隔收窄、单组上限调小，便于观察分组边界。
  configureHabitSequences({
    storeDir: tempDir,
    manualWindowGapMs: 2_000,
    manualGroupMaxActions: 3,
  })
  clearHabitSequencesCache()
})

afterEach(() => {
  clearHabitSequencesCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe('habit-sequences / appendAgentSequence', () => {
  it('ignores runs without actions (returns null, nothing persisted)', () => {
    const id = appendAgentSequence({
      sessionKey: 'sess:1',
      runId: 'run:empty',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 10,
      actions: [],
    })
    expect(id).toBeNull()
    expect(getHabitSequences()).toEqual([])
    expect(fs.readdirSync(tempDir)).toEqual([])
  })

  it('persists a run as an agent sequence ordered by action.order', () => {
    const id = appendAgentSequence({
      profileName: 'default',
      sessionKey: 'sess:1',
      runId: 'run:abc',
      intentLabel: '整理季度财务报告',
      intentCategory: 'analysis',
      intentAction: 'Organize',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 10,
      actions: [
        actionNode({ order: 1, tool: 'terminal', action: 'execute_shell', subject: 'ls' }),
        actionNode({ order: 0, tool: 'files', action: 'read', subject: 'report.xlsx' }),
      ],
    })

    expect(id).toBe('run:run:abc')
    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(1)
    const seq = sequences[0]
    expect(seq.kind).toBe('agent')
    expect(seq.sessionKey).toBe('sess:1')
    expect(seq.intentLabel).toBe('整理季度财务报告')
    expect(seq.intentCategory).toBe('analysis')
    expect(seq.intentAction).toBe('Organize')
    // 动作按 order 升序收敛为一段序列
    expect(seq.actions.map((node) => node.action)).toEqual(['read', 'execute_shell'])
    // 落盘文件随档案隔离（default -> profile.json）
    expect(fs.existsSync(path.join(tempDir, 'profile.json'))).toBe(true)
  })

  it('returns sequences newest-first and respects limit', () => {
    appendAgentSequence({
      profileName: 'default',
      sessionKey: null,
      runId: 'run:older',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 5,
      actions: [actionNode({ order: 0, tool: 'files', action: 'read' })],
    })
    appendAgentSequence({
      profileName: 'default',
      sessionKey: null,
      runId: 'run:newer',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 10,
      actions: [actionNode({ order: 0, tool: 'files', action: 'write' })],
    })

    const limited = getHabitSequences({ limit: 1 })
    expect(limited).toHaveLength(1)
    expect(limited[0].endedTs).toBe(BASE_TS + 10)
    expect(limited[0].actions[0].action).toBe('write')
  })

  it('filters by kind and survives a cache reset (disk persistence)', () => {
    appendAgentSequence({
      profileName: 'default',
      sessionKey: null,
      runId: 'run:1',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 10,
      actions: [actionNode({ order: 0, tool: 'files', action: 'read' })],
    })

    clearHabitSequencesCache()
    const sequences = getHabitSequences({ kind: 'agent' })
    expect(sequences).toHaveLength(1)
    expect(getHabitSequences({ kind: 'manual-window' })).toEqual([])
  })

  it('isolates sequences by profileName into separate store files', () => {
    appendAgentSequence({
      profileName: 'bob',
      sessionKey: null,
      runId: 'run:bob',
      startedTs: BASE_TS,
      endedTs: BASE_TS + 10,
      actions: [actionNode({ order: 0, tool: 'files', action: 'read' })],
    })
    expect(getHabitSequences({ profileName: 'bob' })).toHaveLength(1)
    expect(getHabitSequences({ profileName: 'admin' })).toHaveLength(0)
    expect(fs.existsSync(path.join(tempDir, 'bob.json'))).toBe(true)
  })
})

describe('habit-sequences / ingestManualDecision', () => {
  it('ignores non-guard sources and needs_confirmation results', () => {
    // 审批链路的最终决策不进入手动窗口聚合
    ingestManualDecision(
      decision({ source: 'approval', result: 'allowed', action: 'navigate', ts: BASE_TS }),
    )
    // 需用户二次确认的中间态不视为已落地动作
    ingestManualDecision(
      manualDecision('terminal', 'needs_confirmation', BASE_TS + 1),
    )
    flushManualWindow()
    expect(getHabitSequences()).toEqual([])
  })

  it('groups adjacent manual actions into one sequence within the window gap', () => {
    ingestManualDecision(manualDecision('directory', 'allowed', BASE_TS, { subject: 'D:\\a' }))
    ingestManualDecision(
      manualDecision('website', 'denied', BASE_TS + 1_000, { action: 'navigate', subject: 'https://x.com' }),
    )
    flushManualWindow()

    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(1)
    expect(sequences[0].kind).toBe('manual-window')
    expect(sequences[0].sessionKey).toBeNull()
    expect(sequences[0].actions).toHaveLength(2)
    // 动作原文作为个人要素本地保留，subject 截断后写入
    expect(sequences[0].actions[0].subject).toBe('D:\\a')
    expect(sequences[0].actions[1].tool).toBe('website')
    expect(sequences[0].actions[1].outcome).toBe('denied')
  })

  it('splits into two sequences when the gap between decisions exceeds the window', () => {
    ingestManualDecision(manualDecision('terminal', 'allowed', BASE_TS, { action: 'execute_shell' }))
    // 超过 2s 窗口 -> 前一组收口，本条另起一组
    ingestManualDecision(
      manualDecision('directory', 'allowed', BASE_TS + 3_000, { subject: 'D:\\b' }),
    )
    flushManualWindow()

    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(2)
    const [newer, older] = sequences
    expect(older.endedTs).toBe(BASE_TS)
    expect(newer.startedTs).toBe(BASE_TS + 3_000)
    expect(older.actions).toHaveLength(1)
    expect(newer.actions).toHaveLength(1)
  })

  it('force-closes a group once it reaches the max-actions cap', () => {
    for (let i = 0; i < 4; i += 1) {
      ingestManualDecision(
        manualDecision('directory', 'allowed', BASE_TS + i * 100, { subject: `D:\\dir${i}` }),
      )
    }
    // 第 4 条触发 cap（上限 3）将前三项收口为一条序列，第 4 项暂留内存组
    const persisted = getHabitSequences()
    expect(persisted).toHaveLength(1)
    expect(persisted[0].actions).toHaveLength(3)

    flushManualWindow()
    const after = getHabitSequences()
    expect(after).toHaveLength(2)
    expect(after[0].actions).toHaveLength(1)
  })

  it('flushes the in-memory group by raw profileName (key semantics)', () => {
    // profileName 含空格与特殊字符：落盘文件名做安全化，内存组与查询用原始名
    const rawName = 'zhang san@work'
    ingestManualDecision(
      manualDecision('directory', 'allowed', BASE_TS, {
        profileName: rawName,
        subject: 'D:\\workspace',
      }),
    )
    flushManualWindow({ profileName: rawName })

    const sequences = getHabitSequences({ profileName: rawName })
    expect(sequences).toHaveLength(1)
    // 落盘文件名已安全化
    expect(fs.existsSync(path.join(tempDir, 'zhang_san_work.json'))).toBe(true)
    // 其它档案不受影响
    expect(getHabitSequences({ profileName: 'default' })).toHaveLength(0)
  })

  it('reset clears persisted sequences for a profile', () => {
    ingestManualDecision(manualDecision('terminal', 'allowed', BASE_TS))
    flushManualWindow()
    expect(getHabitSequences()).toHaveLength(1)

    resetHabitSequences()
    expect(getHabitSequences()).toEqual([])
    const raw = JSON.parse(
      fs.readFileSync(path.join(tempDir, 'profile.json'), 'utf-8'),
    ) as { sequences: Array<unknown> }
    expect(raw.sequences).toEqual([])
  })
})
