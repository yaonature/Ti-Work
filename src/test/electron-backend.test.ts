/**
 * G5 contract tests — Electron shell backend process lifecycle (pure logic + real net integration).
 *
 * Coverage:
 *  - buildSpawnSpec: backend spawn command construction (node executable selection, PORT/HOST injection, extraEnv override)
 *  - isBackendHealthy / waitForBackend: health check and polling (injected probe functions returning real fetch semantics)
 *  - findAvailablePort / isPortInUse: port conflict handling (isPortInUse uses real node:net listening)
 *
 * No electron runtime dependency; probes return contracted responses injected by tests — test doubles, not business-logic mocks.
 */
import { createServer } from 'node:net'
import { describe, expect, it } from 'vitest'
import {
  buildSpawnSpec,
  findAvailablePort,
  isBackendHealthy,
  isPortInUse,
  waitForBackend,
} from '../../electron/backend'

describe('buildSpawnSpec', () => {
  it('defaults to the system node and injects PORT/HOST', () => {
    const spec = buildSpawnSpec({
      projectRoot: 'D:/proj',
      port: 3000,
      host: '127.0.0.1',
    })
    expect(spec.command).toBe('node')
    expect(spec.args).toEqual(['server-entry.js'])
    expect(spec.cwd).toBe('D:/proj')
    expect(spec.env.PORT).toBe('3000')
    expect(spec.env.HOST).toBe('127.0.0.1')
  })

  it('an explicit nodeBin takes precedence over the system node', () => {
    const spec = buildSpawnSpec({
      nodeBin: 'C:/custom/node.exe',
      projectRoot: 'D:/proj',
      port: 3100,
      host: '127.0.0.1',
    })
    expect(spec.command).toBe('C:/custom/node.exe')
  })

  it('uses the packaged runtime in node mode when runtimeBin is provided', () => {
    const spec = buildSpawnSpec({
      runtimeBin: 'C:/Program Files/Ti Work/Ti Work.exe',
      projectRoot: 'D:/proj',
      port: 3200,
      host: '127.0.0.1',
    })
    expect(spec.command).toBe('C:/Program Files/Ti Work/Ti Work.exe')
    expect(spec.env.ELECTRON_RUN_AS_NODE).toBe('1')
  })

  it('extraEnv overrides the default PORT/HOST', () => {
    const spec = buildSpawnSpec({
      projectRoot: 'D:/proj',
      port: 3000,
      host: '127.0.0.1',
      extraEnv: { PORT: '4000', REDIS_URL: 'redis://x:6379' },
    })
    expect(spec.env.PORT).toBe('4000')
    expect(spec.env.HOST).toBe('127.0.0.1')
    expect(spec.env.REDIS_URL).toBe('redis://x:6379')
  })

  it('a blank nodeBin falls back to the system node', () => {
    const spec = buildSpawnSpec({
      nodeBin: '   ',
      projectRoot: 'D:/proj',
      port: 3000,
      host: '127.0.0.1',
    })
    expect(spec.command).toBe('node')
  })
})

describe('isBackendHealthy', () => {
  it('a healthy response returns true', async () => {
    const probe = async () => ({ ok: true })
    await expect(isBackendHealthy('http://127.0.0.1:3000', probe)).resolves.toBe(
      true,
    )
  })

  it('a non-2xx response returns false', async () => {
    const probe = async () => ({ ok: false })
    await expect(isBackendHealthy('http://127.0.0.1:3000', probe)).resolves.toBe(
      false,
    )
  })

  it('a throwing probe is treated as unreachable', async () => {
    const probe = async () => {
      throw new Error('connection refused')
    }
    await expect(isBackendHealthy('http://127.0.0.1:3000', probe)).resolves.toBe(
      false,
    )
  })
})

describe('waitForBackend', () => {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  it('returns immediately when the first probe is healthy', async () => {
    let calls = 0
    const probe = async () => {
      calls++
      return { ok: true }
    }
    const ok = await waitForBackend('http://127.0.0.1:3000', {
      timeoutMs: 1000,
      intervalMs: 10,
      probe,
      sleep,
    })
    expect(ok).toBe(true)
    expect(calls).toBe(1)
  })

  it('polls until healthy after initial failures', async () => {
    let calls = 0
    const probe = async () => {
      calls++
      return { ok: calls >= 3 }
    }
    const ok = await waitForBackend('http://127.0.0.1:3000', {
      timeoutMs: 2000,
      intervalMs: 5,
      probe,
      sleep,
    })
    expect(ok).toBe(true)
    expect(calls).toBe(3)
  })

  it('returns false when not ready before the timeout', async () => {
    const probe = async () => ({ ok: false })
    const ok = await waitForBackend('http://127.0.0.1:3000', {
      timeoutMs: 40,
      intervalMs: 20,
      probe,
      sleep,
    })
    expect(ok).toBe(false)
  })

  it('onTick reports the elapsed wait in milliseconds', async () => {
    const ticks: Array<number> = []
    const probe = async () => ({ ok: false })
    await waitForBackend('http://127.0.0.1:3000', {
      timeoutMs: 45,
      intervalMs: 15,
      probe,
      sleep,
      onTick: (elapsed) => ticks.push(elapsed),
    })
    expect(ticks.length).toBeGreaterThanOrEqual(1)
    for (const t of ticks) expect(t).toBeGreaterThanOrEqual(0)
  })
})

describe('findAvailablePort / isPortInUse', () => {
  it('hits directly when the preferred port is free', async () => {
    const probe = async (port: number) => port === 3000
    await expect(findAvailablePort(3000, probe, 5)).resolves.toBe(3000)
  })

  it('scans upward when the preferred port is taken', async () => {
    const probe = async (port: number) => port >= 3001
    await expect(findAvailablePort(3000, probe, 5)).resolves.toBe(3001)
  })

  it('rejects when every port in range is taken', async () => {
    const probe = async () => false
    await expect(findAvailablePort(3000, probe, 3)).rejects.toThrow(
      /no free port/i,
    )
  })

  it('real net integration: a listening port is busy, a released port is free', async () => {
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (address === null || typeof address === 'string') {
      server.close()
      throw new Error('failed to bind test server')
    }
    const port = address.port
    await expect(isPortInUse(port)).resolves.toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await expect(isPortInUse(port)).resolves.toBe(false)
  })
})
