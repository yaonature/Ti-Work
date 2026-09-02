/**
 * G6 integration config storage — pure logic contract tests.
 * Config object-level operations (extract/write/mask/normalize); file IO is injected via explicit paths.
 */
import { describe, expect, it } from 'vitest'
import {
  getChannelSettings,
  getFeishuAppSettings,
  maskSecret,
  maskUrl,
  normalizeWebhookUrl,
  readConfigFile,
  setChannelSettings,
  setFeishuAppSettings,
  toChannelState,
  toFeishuAppState,
  writeConfigFile,
} from '../server/integrations'
import { createTempDirHarness } from './harness/temp-dir-harness'

const FEISHU_URL = 'https://open.feishu.cn/open-apis/bot/v2/hook/abc123xyz'
const DINGTALK_URL = 'https://oapi.dingtalk.com/robot/send?access_token=abc123xyz'

const SAMPLE_CONFIG = {
  model: 'gpt-5.4',
  integrations: {
    feishu: {
      enabled: true,
      webhook_url: FEISHU_URL,
      secret: 'SECret123',
    },
  },
}

describe('getChannelSettings', () => {
  it('extracts the settings of a configured channel', () => {
    const s = getChannelSettings(SAMPLE_CONFIG, 'feishu')
    expect(s).not.toBeNull()
    expect(s?.enabled).toBe(true)
    expect(s?.webhookUrl).toBe(FEISHU_URL)
    expect(s?.secret).toBe('SECret123')
  })

  it('a missing channel returns null', () => {
    expect(getChannelSettings(SAMPLE_CONFIG, 'dingtalk')).toBeNull()
  })

  it('an empty config object returns null', () => {
    expect(getChannelSettings({}, 'feishu')).toBeNull()
  })

  it('a non-object integrations section returns null', () => {
    expect(getChannelSettings({ integrations: 'nope' }, 'feishu')).toBeNull()
  })
})

describe('setChannelSettings', () => {
  it('writes a new channel and keeps the remaining fields', () => {
    const next = setChannelSettings(SAMPLE_CONFIG, 'dingtalk', {
      enabled: true,
      webhookUrl: DINGTALK_URL,
      secret: 'SEC1',
    })
    expect(next.model).toBe('gpt-5.4')
    const integrations = next.integrations as Record<string, Record<string, unknown>>
    expect(integrations.feishu.webhook_url).toBe(FEISHU_URL)
    const dt = integrations.dingtalk
    expect(dt).toEqual({
      enabled: true,
      webhook_url: DINGTALK_URL,
      secret: 'SEC1',
    })
  })

  it('a null value removes the whole channel section', () => {
    const next = setChannelSettings(SAMPLE_CONFIG, 'feishu', null)
    expect(
      (next.integrations as Record<string, unknown> | undefined)?.feishu,
    ).toBeUndefined()
    expect(next.model).toBe('gpt-5.4')
  })

  it('an empty config object can create the integrations section', () => {
    const next = setChannelSettings({}, 'feishu', {
      enabled: false,
      webhookUrl: FEISHU_URL,
      secret: '',
    })
    expect((next.integrations as Record<string, Record<string, unknown>>).feishu.enabled).toBe(false)
  })

  it('returns a new object without mutating the original config', () => {
    const before = JSON.stringify(SAMPLE_CONFIG)
    setChannelSettings(SAMPLE_CONFIG, 'dingtalk', {
      enabled: true,
      webhookUrl: DINGTALK_URL,
      secret: 'SEC1',
    })
    expect(JSON.stringify(SAMPLE_CONFIG)).toBe(before)
  })
})

describe('maskSecret / maskUrl', () => {
  it('a long secret keeps the first and last 4 characters', () => {
    expect(maskSecret('SECret123456789')).toBe('SECr...6789')
  })

  it('a short secret is fully masked', () => {
    expect(maskSecret('short')).toBe('***')
  })

  it('an empty secret is fully masked', () => {
    expect(maskSecret('')).toBe('***')
  })

  it('a URL keeps the protocol and host, the token tail keeps 4 characters', () => {
    const masked = maskUrl(FEISHU_URL)
    expect(masked.startsWith('https://open.feishu.cn/open-apis/bot/v2/hook/')).toBe(true)
    expect(masked.endsWith('***3xyz')).toBe(true)
    expect(masked).not.toContain('abc123xyz'.slice(0, 3))
  })
})

describe('normalizeWebhookUrl', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizeWebhookUrl(`  ${FEISHU_URL}  `)).toBe(FEISHU_URL)
  })
})

describe('toChannelState', () => {
  it('unconfigured returns configured=false', () => {
    const state = toChannelState(null)
    expect(state.configured).toBe(false)
    expect(state.enabled).toBe(false)
    expect(state.secretSet).toBe(false)
  })

  it('configured returns the masked state', () => {
    const state = toChannelState({
      enabled: true,
      webhookUrl: FEISHU_URL,
      secret: 'SECret123456789',
    })
    expect(state.configured).toBe(true)
    expect(state.enabled).toBe(true)
    expect(state.secretSet).toBe(true)
    expect(state.secretMasked).toBe('SECr...6789')
    expect(state.webhookUrlMasked.endsWith('***3xyz')).toBe(true)
  })

  it('an empty secret is treated as unset', () => {
    const state = toChannelState({
      enabled: false,
      webhookUrl: FEISHU_URL,
      secret: '',
    })
    expect(state.secretSet).toBe(false)
  })
})

describe('getFeishuAppSettings', () => {
  it('returns null when no app credentials are stored', () => {
    expect(getFeishuAppSettings(SAMPLE_CONFIG)).toBeNull()
    expect(getFeishuAppSettings({})).toBeNull()
  })

  it('reads the app_* fields when configured', () => {
    const config = {
      integrations: {
        feishu: {
          enabled: true,
          webhook_url: FEISHU_URL,
          app_id: 'cli_abc123',
          app_secret: 'SECret123456789',
          app_token: 't-xyz123',
          app_verified: true,
        },
      },
    }
    const s = getFeishuAppSettings(config)
    expect(s).not.toBeNull()
    expect(s?.appId).toBe('cli_abc123')
    expect(s?.appSecret).toBe('SECret123456789')
    expect(s?.appToken).toBe('t-xyz123')
    expect(s?.appVerified).toBe(true)
  })
})

describe('setFeishuAppSettings', () => {
  it('merges app_* fields while preserving webhook fields', () => {
    const next = setFeishuAppSettings(SAMPLE_CONFIG, {
      appId: 'cli_abc123',
      appSecret: 'SECret123456789',
      appToken: 't-xyz123',
      appVerified: true,
    })
    const feishu = (next.integrations as Record<string, Record<string, unknown>>)
      .feishu
    expect(feishu.webhook_url).toBe(FEISHU_URL)
    expect(feishu.enabled).toBe(true)
    expect(feishu.secret).toBe('SECret123')
    expect(feishu.app_id).toBe('cli_abc123')
    expect(feishu.app_secret).toBe('SECret123456789')
    expect(feishu.app_token).toBe('t-xyz123')
    expect(feishu.app_verified).toBe(true)
  })

  it('a null value clears only the app_* fields and keeps webhook config', () => {
    const withApp = setFeishuAppSettings(SAMPLE_CONFIG, {
      appId: 'cli_abc123',
      appSecret: 'SECret123456789',
      appToken: 't-xyz123',
      appVerified: true,
    })
    const next = setFeishuAppSettings(withApp, null)
    const feishu = (next.integrations as Record<string, Record<string, unknown>>)
      .feishu
    expect(feishu.webhook_url).toBe(FEISHU_URL)
    expect(feishu.enabled).toBe(true)
    expect(feishu.app_id).toBeUndefined()
    expect(feishu.app_secret).toBeUndefined()
  })

  it('a null value removes the whole feishu section when no webhook fields remain', () => {
    const onlyApp = { integrations: { feishu: { app_id: 'cli_1', app_secret: 's' } } }
    const next = setFeishuAppSettings({ ...onlyApp }, null)
    expect(
      (next.integrations as Record<string, unknown> | undefined)?.feishu,
    ).toBeUndefined()
  })

  it('returns a new object without mutating the original config', () => {
    const before = JSON.stringify(SAMPLE_CONFIG)
    setFeishuAppSettings(SAMPLE_CONFIG, {
      appId: 'cli_abc123',
      appSecret: 'SECret123456789',
      appToken: 't-xyz123',
      appVerified: true,
    })
    expect(JSON.stringify(SAMPLE_CONFIG)).toBe(before)
  })
})

describe('toFeishuAppState', () => {
  it('unconfigured returns configured=false', () => {
    const state = toFeishuAppState(null)
    expect(state.configured).toBe(false)
    expect(state.verified).toBe(false)
    expect(state.appId).toBe('')
    expect(state.appSecretSet).toBe(false)
  })

  it('configured returns appId and masked appSecret', () => {
    const state = toFeishuAppState({
      appId: 'cli_abc123',
      appSecret: 'SECret123456789',
      appToken: 't-xyz123',
      appVerified: true,
    })
    expect(state.configured).toBe(true)
    expect(state.verified).toBe(true)
    expect(state.appId).toBe('cli_abc123')
    expect(state.appSecretSet).toBe(true)
    expect(state.appSecretMasked).toBe('SECr...6789')
  })
})

describe('readConfigFile / writeConfigFile', () => {
  it('a nonexistent file returns an empty object', () => {
    const config = readConfigFile('/nonexistent/tiwork/config.yaml')
    expect(config).toEqual({})
  })

  it('atomic write allows the full content to be read back', async () => {
    const harness = createTempDirHarness('tiwork-integrations-')
    const file = harness.path('config.yaml')
    try {
      const config = { model: 'gpt-5.4', integrations: {} }
      writeConfigFile(file, config)
      const raw = readConfigFile(file)
      expect(raw.model).toBe('gpt-5.4')
      expect(typeof raw.integrations).toBe('object')
    } finally {
      harness.cleanup()
    }
  })
})
