/**
 * G6 Feishu/DingTalk webhook delivery — pure logic (unit-testable in a node environment).
 *
 * Signature algorithm follows the official docs:
 * - DingTalk: sign = urlencode(base64(hmac-sha256(key=secret, data=`${ts}\n${secret}`))), passed via URL query
 * - Feishu: sign = base64(hmac-sha256(key=`${ts}\n${secret}`, data='')), passed via request header
 * Network side effects are driven by the injected fetcher.
 */
import { createHmac } from 'node:crypto'

export type IntegrationChannel = 'feishu' | 'dingtalk'

export interface DeliveryTarget {
  url: string
  headers: Record<string, string>
}

export interface WebhookResponse {
  ok: boolean
  status: number
}

export interface WebhookFetcherInit {
  method: string
  headers: Record<string, string>
  body: string
}

export type WebhookFetcher = (
  url: string,
  init: WebhookFetcherInit,
) => Promise<WebhookResponse>

/** DingTalk signing: key=secret, data=`${timestamp}\n${secret}`, base64 then URL-encoded */
export function buildDingtalkSignature(secret: string, timestamp: number): string {
  const sign = createHmac('sha256', secret)
    .update(`${timestamp}\n${secret}`)
    .digest('base64')
  return encodeURIComponent(sign)
}

/** Feishu signing: key=`${timestamp}\n${secret}`, data is an empty string */
export function buildFeishuSignature(secret: string, timestamp: number): string {
  return createHmac('sha256', `${timestamp}\n${secret}`)
    .update('')
    .digest('base64')
}

/** Build a signed delivery target: Feishu via request header, DingTalk via URL query */
export function buildDeliveryTarget(
  channel: IntegrationChannel,
  webhookUrl: string,
  secret: string,
  timestamp: number,
): DeliveryTarget {
  if (channel === 'feishu') {
    return {
      url: webhookUrl,
      headers: {
        'X-Lark-Request-Timestamp': String(timestamp),
        'X-Lark-Signature': buildFeishuSignature(secret, timestamp),
      },
    }
  }
  const sign = buildDingtalkSignature(secret, timestamp)
  const separator = webhookUrl.includes('?') ? '&' : '?'
  return {
    url: `${webhookUrl}${separator}timestamp=${timestamp}&sign=${sign}`,
    headers: {},
  }
}

/** Test message payload: Feishu msg_type/content, DingTalk msgtype/text */
export function buildTestPayload(channel: IntegrationChannel): Record<string, unknown> {
  const text = 'Ti Work integration test message ✓'
  if (channel === 'feishu') {
    return { msg_type: 'text', content: { text } }
  }
  return { msgtype: 'text', text: { content: text } }
}

export interface SendTestOptions {
  channel: IntegrationChannel
  webhookUrl: string
  secret: string
  fetcher: WebhookFetcher
  /** Injectable fixed timestamp (for tests), defaults to the current time */
  timestamp?: number
}

/** Send a test message to the channel webhook and return the delivery result */
export async function sendTestWebhook(
  opts: SendTestOptions,
): Promise<WebhookResponse> {
  const timestamp = opts.timestamp ?? Date.now()
  const target = buildDeliveryTarget(
    opts.channel,
    opts.webhookUrl,
    opts.secret,
    timestamp,
  )
  try {
    return await opts.fetcher(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...target.headers,
      },
      body: JSON.stringify(buildTestPayload(opts.channel)),
    })
  } catch {
    return { ok: false, status: 0 }
  }
}
