import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTempDirHarness } from './harness/temp-dir-harness'
import {
  expectJsonStatus,
  invokeRouteHandler,
  makeContractRequest,
} from './harness/contract-harness'

describe('P0 contract: Hermes models fallback', () => {
  afterEach(() => {
    vi.resetModules()
    delete process.env.HERMES_HOME
    delete process.env.HERMES_API_URL
    delete process.env.HOME
    delete process.env.USERPROFILE
    delete process.env.LOCALAPPDATA
    delete process.env.HERMES_PASSWORD
  })

  it('网关不可达时仍会从 legacy .hermes/.env 暴露已配置的 DeepSeek 模型', async () => {
    const harness = createTempDirHarness('ti-work-p0-models-')
    try {
      const hermesHome = harness.path('active-hermes')
      const legacyHome = harness.path('legacy-home')
      mkdirSync(hermesHome, { recursive: true })
      mkdirSync(join(legacyHome, '.hermes'), { recursive: true })
      writeFileSync(
        join(legacyHome, '.hermes', '.env'),
        'DEEPSEEK_API_KEY=sk-legacy-key\n',
        'utf-8',
      )

      process.env.HERMES_HOME = hermesHome
      process.env.HERMES_API_URL = 'http://127.0.0.1:1'
      process.env.HOME = legacyHome
      process.env.USERPROFILE = legacyHome
      process.env.LOCALAPPDATA = harness.path('LocalAppData')

      vi.resetModules()
      const response = await invokeRouteHandler(
        '@/routes/api/models',
        'GET',
        makeContractRequest(null, { path: '/api/models' }),
      )
      const { body } = await expectJsonStatus(response, 200)
      expect(body.ok).toBe(true)
      expect(body.source).toBe('configured-providers')
      expect(body.configuredProviders).toEqual(['deepseek'])
      expect(body.models).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'deepseek-v4-flash', provider: 'deepseek' }),
          expect.objectContaining({ id: 'deepseek-v4-pro', provider: 'deepseek' }),
        ]),
      )
    } finally {
      harness.cleanup()
    }
  })
})
