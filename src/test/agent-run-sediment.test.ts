import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearAgentSedimentTraces,
  configureAgentSediment,
  discardRun,
  noteApprovalRequired,
  noteArtifactCreated,
  noteRunEnded,
  noteRunStarted,
  noteToolCompleted,
  noteToolFailed,
} from '@/server/agent-run-sediment'
import {
  clearHabitSequencesCache,
  configureHabitSequences,
  getHabitSequences,
} from '@/server/habit-sequences'

const INTENT = {
  label: '整理季度财务报告',
  category: 'analysis' as const,
  action: 'Organize',
}

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-sed-test-'))
  configureHabitSequences({ storeDir: tempDir })
  clearHabitSequencesCache()
  clearAgentSedimentTraces()
  configureAgentSediment({ maxTraces: 4, traceTtlMs: 60_000 })
})

afterEach(() => {
  clearAgentSedimentTraces()
  clearHabitSequencesCache()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

function startRun(runId = 'run:1', sessionKey = 'sess:1'): void {
  noteRunStarted({ runId, sessionKey, intent: INTENT })
}

describe('agent-run-sediment', () => {
  it('commits a run with ordered tool actions into an agent sequence', () => {
    startRun()
    noteToolCompleted('run:1', {
      toolName: 'files',
      toolCallId: 'call:1',
      args: { path: 'D:\\workspace\\report.xlsx' },
      summary: '已读取 12 行',
    })
    noteToolCompleted('run:1', {
      toolName: 'terminal',
      toolCallId: 'call:2',
      args: { command: 'pnpm build' },
      summary: 'build 成功',
    })
    noteArtifactCreated('run:1', {
      toolName: 'files',
      subject: 'D:\\out\\report.docx',
      summary: '季度财务报告',
    })

    const id = noteRunEnded('run:1')
    expect(id).toBe('run:run:1')

    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(1)
    const seq = sequences[0]
    expect(seq.kind).toBe('agent')
    expect(seq.sessionKey).toBe('sess:1')
    expect(seq.intentLabel).toBe('整理季度财务报告')
    expect(seq.intentCategory).toBe('analysis')
    expect(seq.intentAction).toBe('Organize')
    expect(seq.actions).toHaveLength(3)
    // 按事件到达顺序沉淀为有序序列
    expect(seq.actions.map((node) => node.tool)).toEqual([
      'files',
      'terminal',
      'files',
    ])
    expect(seq.actions.map((node) => node.outcome)).toEqual([
      'ok',
      'ok',
      'ok',
    ])
    // 主体从工具参数中提炼（命令/路径原文，本地保留）
    expect(seq.actions[0].subject).toBe('D:\\workspace\\report.xlsx')
    expect(seq.actions[1].subject).toBe('pnpm build')
    expect(seq.actions[2].subject).toBe('D:\\out\\report.docx')
  })

  it('ignores pure-chat runs (no tool actions) without persisting', () => {
    startRun()
    const id = noteRunEnded('run:1')
    expect(id).toBeNull()
    expect(getHabitSequences()).toEqual([])
    expect(fs.readdirSync(tempDir)).toEqual([])
  })

  it('records a failed tool with error outcome and message', () => {
    startRun()
    noteToolFailed('run:1', {
      toolName: 'terminal',
      toolCallId: 'call:1',
      args: { command: 'rm -rf dist' },
      summary: 'permission denied',
    })
    noteRunEnded('run:1')

    const seq = getHabitSequences()[0]
    expect(seq.actions).toHaveLength(1)
    expect(seq.actions[0].outcome).toBe('error')
    expect(seq.actions[0].summary).toBe('permission denied')
  })

  it('records an approval-required decision point as pending_approval', () => {
    startRun()
    noteApprovalRequired('run:1', {
      action: 'shutdown /s',
      context: 'shutdown /s /t 0',
    })
    noteRunEnded('run:1')

    const seq = getHabitSequences()[0]
    expect(seq.actions[0].tool).toBe('approval')
    expect(seq.actions[0].outcome).toBe('pending_approval')
    expect(seq.actions[0].action).toBe('shutdown /s')
    expect(seq.actions[0].subject).toBe('shutdown /s /t 0')
  })

  it('drops the run entirely when discarded before completion', () => {
    startRun()
    noteToolCompleted('run:1', {
      toolName: 'files',
      toolCallId: 'call:1',
      args: { path: 'D:\\a' },
    })
    discardRun('run:1')

    // 丢弃后再次收口也应为空
    expect(noteRunEnded('run:1')).toBeNull()
    expect(getHabitSequences()).toEqual([])
  })

  it('treats noteRunStarted as idempotent (no duplicate nodes)', () => {
    startRun()
    startRun()
    noteToolCompleted('run:1', {
      toolName: 'files',
      toolCallId: 'call:1',
      args: { path: 'D:\\a' },
    })
    noteRunEnded('run:1')

    const seq = getHabitSequences()[0]
    expect(seq.actions).toHaveLength(1)
  })

  it('isolates traces by runId', () => {
    startRun('run:1', 'sess:1')
    startRun('run:2', 'sess:2')
    noteToolCompleted('run:1', {
      toolName: 'terminal',
      toolCallId: 'call:1',
      args: { command: 'pnpm test' },
    })
    noteToolCompleted('run:2', {
      toolName: 'web',
      toolCallId: 'call:1',
      args: { url: 'https://example.com' },
    })
    noteRunEnded('run:1')
    noteRunEnded('run:2')

    const sequences = getHabitSequences()
    expect(sequences).toHaveLength(2)
    const bySession = (key: string) =>
      sequences.find((seq) => seq.sessionKey === key)
    expect(bySession('sess:1')?.actions[0].tool).toBe('terminal')
    expect(bySession('sess:2')?.actions[0].tool).toBe('web')
  })

  it('skips internal placeholder tool names', () => {
    startRun()
    noteToolCompleted('run:1', {
      toolName: '_thinking',
      toolCallId: 'call:1',
      summary: '…',
    })
    noteToolCompleted('run:1', {
      toolName: 'tool',
      toolCallId: 'call:2',
      summary: 'fallback',
    })
    noteToolCompleted('run:1', {
      toolName: 'web_search',
      toolCallId: 'call:3',
      args: { query: 'hermes agent' },
    })
    noteRunEnded('run:1')

    const seq = getHabitSequences()[0]
    expect(seq.actions).toHaveLength(1)
    expect(seq.actions[0].tool).toBe('web_search')
  })

  it('ignores empty run ids without creating traces', () => {
    noteRunStarted({ runId: '', sessionKey: null, intent: null })
    expect(noteRunEnded('')).toBeNull()
    expect(getHabitSequences()).toEqual([])
  })
})
