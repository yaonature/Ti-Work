/**
 * 高频任务一键重放（P1-B 行为资产沉淀 — 工作台 → 新会话自动发起）。
 *
 * 工作台「高频任务」卡片是本地行为资产的露出面：用户反复交给 Agent 的
 * 任务被沉淀为「意图 + 步骤模板 + 参数样例 + 频次/周期」画像后，点击卡片
 * 即把最近一次任务措辞暂存（stash），随后导航到新会话；聊天屏挂载时
 * 消费（consume）并自动发起，用户可在该新会话直接编辑措辞后再发送，
 * 避免"盲重放"脱离当下意图。
 *
 * 与 pending-send.ts 的边界：pending-send 面向「已存在会话的续发与恢复」
 * （会话级 key + friendlyId 匹配）；本模块面向「新会话首条消息自动发起」，
 * 与会话 key 解耦，一次 stash 只允许消费一次。
 *
 * 持久化采用 localStorage（短 TTL）而非 sessionStorage：点击跳转若触发
 * 刷新/重载仍可续接；消费即清空，不残留。
 */

import type { ChatAttachment } from './types'

export type HighFrequencyReplayParameterSample = {
  value: string
  count: number
}

export type HighFrequencyReplayPayload = {
  /** 本次重放要发送的任务措辞（复用最近一次执行的真实意图文本，可编辑）。 */
  message: string
  /** 任务展示名（用于可读标识；暂无独立 UI 位时为 message 别名）。 */
  taskLabel: string
  /** 意图类别（英文枚举，工作台展示用）。 */
  intentCategory?: string
  /** 意图动作（英文动词，工作台展示用）。 */
  intentAction?: string
  /** 观察到的参数样例（本地展示，向用户说明自动重放将沿用的具体要素）。 */
  parameterSamples?: Array<HighFrequencyReplayParameterSample>
  /** 稳定任务标识（透传，便于埋点/调试）。 */
  taskId?: string
  attachments?: Array<ChatAttachment>
}

type PersistedReplayPayload = HighFrequencyReplayPayload & {
  stashedAt: number
}

let memoryReplay: PersistedReplayPayload | null = null

const REPLAY_STORAGE_KEY = 'hermes_hf_replay_pending'
const REPLAY_MAX_AGE_MS = 2 * 60 * 1000

function canUseLocalStorage() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  )
}

function isExpiredRecord(record: { stashedAt?: unknown }) {
  if (
    typeof record.stashedAt !== 'number' ||
    !Number.isFinite(record.stashedAt)
  ) {
    return true
  }
  return Date.now() - record.stashedAt > REPLAY_MAX_AGE_MS
}

/** 工作台点击卡片时暂存一次重放（内存 + localStorage 双写）。 */
export function stashHighFrequencyReplay(payload: HighFrequencyReplayPayload) {
  const record: PersistedReplayPayload = { ...payload, stashedAt: Date.now() }
  memoryReplay = record
  if (!canUseLocalStorage()) return
  try {
    window.localStorage.setItem(REPLAY_STORAGE_KEY, JSON.stringify(record))
  } catch {
    // 忽略写入失败（内存副本仍可消费）。
  }
}

/** 取走待重放载荷（单次语义）：内存优先，未命中时读存储，读取即清除。 */
export function consumeHighFrequencyReplay(): HighFrequencyReplayPayload | null {
  let record = memoryReplay
  memoryReplay = null
  if (canUseLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(REPLAY_STORAGE_KEY)
      if (raw) {
        window.localStorage.removeItem(REPLAY_STORAGE_KEY)
      }
      if (!record && raw) {
        try {
          record = JSON.parse(raw) as PersistedReplayPayload
        } catch {
          record = null
        }
      }
    } catch {
      // 忽略存储读写失败；保留内存副本结果。
    }
  }
  if (!record || isExpiredRecord(record)) return null
  const { stashedAt: _stashedAt, ...payload } = record
  return payload
}
