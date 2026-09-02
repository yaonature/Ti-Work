// @vitest-environment jsdom
/**
 * 高频任务一键重放存储模块（P1-B 行为资产沉淀 — 工作台 → 新会话自动发起）。
 *
 * 契约：
 *  - stash 一次 → consume 恰好一次非空（单次消费语义，防重复自动发送）；
 *  - 载荷字段（任务措辞/意图/参数样例/附件）原样透传；
 *  - 过期载荷（TTL 2 分钟）不被消费，防止陈旧的跳转残留自动发消息；
 *  - localStorage 双写支持「跳转后刷新/模块重建」仍可恢复消费。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consumeHighFrequencyReplay,
  stashHighFrequencyReplay,
  type HighFrequencyReplayPayload,
} from '../screens/chat/high-frequency-replay'

const BASE_PAYLOAD: HighFrequencyReplayPayload = {
  message: '修复 src/index.ts 的报错并跑一遍测试',
  taskLabel: '修复 src/index.ts 的报错并跑一遍测试',
  intentCategory: 'coding',
  intentAction: 'Fix',
  parameterSamples: [{ value: 'src/index.ts', count: 3 }],
  taskId: 'hf:coding:Fix:abc123',
}

describe('high-frequency-replay（P1-B 新会话自动发起载荷）', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('无任何 stash 时 consume 返回 null', () => {
    expect(consumeHighFrequencyReplay()).toBeNull()
  })

  it('stash 后恰好可被消费一次，第二次为空（单次消费语义）', () => {
    stashHighFrequencyReplay(BASE_PAYLOAD)
    const first = consumeHighFrequencyReplay()
    expect(first?.message).toBe(BASE_PAYLOAD.message)
    expect(first?.taskId).toBe(BASE_PAYLOAD.taskId)
    expect(consumeHighFrequencyReplay()).toBeNull()
  })

  it('载荷字段（意图/参数样例/附件）原样透传', () => {
    const payload: HighFrequencyReplayPayload = {
      ...BASE_PAYLOAD,
      attachments: [{ id: 'a-1', name: 'contract.docx' }],
    }
    stashHighFrequencyReplay(payload)
    const consumed = consumeHighFrequencyReplay()
    expect(consumed?.intentCategory).toBe('coding')
    expect(consumed?.intentAction).toBe('Fix')
    expect(consumed?.parameterSamples).toEqual(payload.parameterSamples)
    expect(consumed?.attachments).toEqual(payload.attachments)
  })

  it('过期载荷（超过 2 分钟 TTL）不被消费', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T08:00:00Z'))
    stashHighFrequencyReplay(BASE_PAYLOAD)
    vi.advanceTimersByTime(2 * 60 * 1000 + 1)
    expect(consumeHighFrequencyReplay()).toBeNull()
  })

  it('未过期（恰好 2 分钟前）仍可消费', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-02T08:00:00Z'))
    stashHighFrequencyReplay(BASE_PAYLOAD)
    vi.advanceTimersByTime(2 * 60 * 1000)
    expect(consumeHighFrequencyReplay()?.message).toBe(BASE_PAYLOAD.message)
  })

  it('localStorage 双写支持模块重建（模拟跳转后刷新）仍可恢复消费', async () => {
    const stasher = await import('../screens/chat/high-frequency-replay')
    stasher.stashHighFrequencyReplay(BASE_PAYLOAD)
    // 重置模块实例，内存副本随旧模块销毁，仅 localStorage 保留 → 走存储恢复。
    vi.resetModules()
    const fresh = await import('../screens/chat/high-frequency-replay')
    expect(fresh.consumeHighFrequencyReplay()?.message).toBe(
      BASE_PAYLOAD.message,
    )
    // 恢复后单次消费：再次消费应为空。
    expect(fresh.consumeHighFrequencyReplay()).toBeNull()
  })
})
