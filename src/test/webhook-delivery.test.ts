/**
 * G6 Feishu/DingTalk webhook delivery — pure logic contract tests.
 * Signature algorithms are verified against fixed vectors (independently computed);
 * delivery is driven by an injected fetcher.
 */
import { describe, expect, it } from 'vitest'
import {
  buildDeliveryTarget,
  buildDingtalkSignature,
  buildFeishuSignature,
  buildTestPayload,
  sendTestWebhook,
} from '../server/webhook-delivery'
import type { WebhookFetcher } from '../server/webhook-delivery'

// Fixed vector: secret='SEC123', timestamp=1710000000000 (authoritative result computed independently of the implementation)
const TS = 1710000000000
const DINGTALK_RAW = 'cxQKSqNb3SuCXae+hYE8VNP0xtGShCjTtS5H9qCm0Lc='
const DINGTALK_ENCODED = 'cxQKSqNb3SuCXae%2BhYE8VNP0xtGShCjTtS5H9qCm0Lc%3D'
const FEISHU_SIGN = 'OSVwtmsVXyz+clKM2bC27osRMZCwyTL9kQ8/bA0OTOs='

describe('buildDingtalkSignature', () => {
  it('computes the signature against the fixed vector (hmac key=secret, URL-encoded)', () => {
    expect(buildDingtalkSignature('SEC123', TS)).toBe(DINGTALK_ENCODED)
  })

  it('raw base64 matches the vector', () => {
    const raw = decodeURIComponent(buildDingtalkSignature('SEC123', TS))
    expect(raw).toBe(DINGTALK_RAW)
  })
})

describe('buildFeishuSignature', () => {
  it('computes the signature against the fixed vector (hmac key=timestamp+secret, empty data)', () => {
    expect(buildFeishuSignature('SEC123', TS)).toBe(FEISHU_SIGN)
  })
})

describe('buildDeliveryTarget', () => {
  it('feishu signs via request headers, URL unchanged', () => {
    const url = 'https://open.feishu.cn/open-apis/bot/v2/hook/x'
    const target = buildDeliveryTarget('feishu', url, 'SEC123', TS)
    expect(target.url).toBe(url)
    expect(target.headers['X-Lark-Request-Timestamp']).toBe(String(TS))
    expect(target.headers['X-Lark-Signature']).toBe(FEISHU_SIGN)
  })

  it('dingtalk signs via URL query', () => {
    const url = 'https://oapi.dingtalk.com/robot/send?access_token=x'
    const target = buildDeliveryTarget('dingtalk', url, 'SEC123', TS)
    expect(target.url).toContain(`timestamp=${TS}`)
    expect(target.url).toContain(`sign=${DINGTALK_ENCODED}`)
    expect(target.url).toContain('&')
    expect(target.headers).toEqual({})
  })

  it('dingtalk URL without query is joined with ?', () => {
    const target = buildDeliveryTarget('dingtalk', 'https://oapi.dingtalk.com/robot/send', 'SEC123', TS)
    expect(target.url).toMatch(/^https:\/\/oapi\.dingtalk\.com\/robot\/send\?timestamp=/)
  })
})

describe('buildTestPayload', () => {
  it('feishu uses the msg_type/content structure', () => {
    const payload = buildTestPayload('feishu')
    expect(payload.msg_type).toBe('text')
    expect((payload.content as { text?: string }).text).toContain('Ti Work')
  })

  it('dingtalk uses the msgtype/text structure', () => {
    const payload = buildTestPayload('dingtalk')
    expect(payload.msgtype).toBe('text')
    expect((payload.text as { content?: string }).content).toContain('Ti Work')
  })
})

describe('sendTestWebhook', () => {
  const FEISHU_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/test'

  it('successful delivery returns ok', async () => {
    const captured: Array<{ url: string; headers: Record<string, string>; body: string }> = []
    const fetcher: WebhookFetcher = async (url, init) => {
      captured.push({ url, headers: init.headers, body: init.body })
      return { ok: true, status: 200 }
    }
    const result = await sendTestWebhook({
      channel: 'feishu',
      webhookUrl: FEISHU_URL,
      secret: 'SEC123',
      fetcher,
    })
    expect(result.ok).toBe(true)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.url).toBe(FEISHU_URL)
    expect(captured[0]?.body).toContain('Ti Work')
  })

  it('failed delivery returns non-ok', async () => {
    const fetcher: WebhookFetcher = async () => ({ ok: false, status: 403 })
    const result = await sendTestWebhook({
      channel: 'dingtalk',
      webhookUrl: 'https://oapi.dingtalk.com/robot/send',
      secret: 'SEC123',
      fetcher,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })

  it('a throwing fetcher is treated as failure', async () => {
    const fetcher: WebhookFetcher = async () => {
      throw new Error('ETIMEDOUT')
    }
    const result = await sendTestWebhook({
      channel: 'feishu',
      webhookUrl: FEISHU_URL,
      secret: 'SEC123',
      fetcher,
    })
    expect(result.ok).toBe(false)
  })
})
