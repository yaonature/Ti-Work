/**
 * G6 gateway reload — pure logic contract tests.
 * Probe and reload requests are injected as parameters (test doubles), covering all three result states.
 */
import { describe, expect, it } from 'vitest'
import { reloadGatewayConfig } from '../server/gateway-reload'
import type { ReloadRequest, UrlProbe } from '../server/gateway-reload'

const BASE = 'http://127.0.0.1:8642'

function okRequest(status = 200): ReloadRequest {
  return async () => ({ ok: status >= 200 && status < 300, status })
}

describe('reloadGatewayConfig', () => {
  it('gateway offline returns gateway-offline', async () => {
    const probe: UrlProbe = async () => false
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: ['/api/config/reload'],
      probe,
      reloadRequest: okRequest(),
    })
    expect(result.status).toBe('gateway-offline')
    expect(result.detail).toContain('offline')
  })

  it('a throwing probe is treated as offline', async () => {
    const probe: UrlProbe = async () => {
      throw new Error('ECONNREFUSED')
    }
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: ['/api/config/reload'],
      probe,
      reloadRequest: okRequest(),
    })
    expect(result.status).toBe('gateway-offline')
  })

  it('health probe uses the injected healthUrl', async () => {
    let probedUrl = ''
    const probe: UrlProbe = async (url) => {
      probedUrl = url
      return true
    }
    await reloadGatewayConfig({
      baseUrl: BASE,
      healthUrl: '/healthz',
      reloadEndpoints: ['/api/config/reload'],
      probe,
      reloadRequest: okRequest(),
    })
    expect(probedUrl).toBe(`${BASE}/healthz`)
  })

  it('first endpoint reload success returns reloaded', async () => {
    const probed: Array<string> = []
    const reloadRequest: ReloadRequest = async (url) => {
      probed.push(url)
      return { ok: true, status: 200 }
    }
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: ['/api/config/reload', '/config/reload'],
      probe: async () => true,
      reloadRequest,
    })
    expect(result.status).toBe('reloaded')
    expect(probed).toEqual([`${BASE}/api/config/reload`])
  })

  it('first endpoint failure falls through to the next one', async () => {
    const probed: Array<string> = []
    const reloadRequest: ReloadRequest = async (url) => {
      probed.push(url)
      return url.includes('api/config/reload')
        ? { ok: false, status: 404 }
        : { ok: true, status: 200 }
    }
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: ['/api/config/reload', '/config/reload'],
      probe: async () => true,
      reloadRequest,
    })
    expect(result.status).toBe('reloaded')
    expect(probed).toHaveLength(2)
  })

  it('all endpoints failing returns reload-failed with the attempt count', async () => {
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: ['/api/config/reload', '/config/reload'],
      probe: async () => true,
      reloadRequest: async () => ({ ok: false, status: 500 }),
    })
    expect(result.status).toBe('reload-failed')
    expect(result.detail).toContain('2')
  })

  it('an empty endpoint list returns reload-failed', async () => {
    const result = await reloadGatewayConfig({
      baseUrl: BASE,
      reloadEndpoints: [],
      probe: async () => true,
      reloadRequest: okRequest(),
    })
    expect(result.status).toBe('reload-failed')
  })
})
