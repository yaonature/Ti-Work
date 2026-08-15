/**
 * EngineManager pure logic tests — resolveEngineLauncher / waitForEngine / status states.
 * No electron runtime needed; runs directly in node.
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  EngineManager,
  resolveEngineLauncher,
  resolveFromPath,
  waitForEngine,
  type EngineHealthProbe,
} from '../../electron/hermes-engine'

describe('resolveEngineLauncher', () => {
  it('prefers explicit HERMES_ENGINE_BIN env', () => {
    const launcher = resolveEngineLauncher('/tmp/root', {
      HERMES_ENGINE_BIN: 'C:/engine/hermes.exe',
    } as NodeJS.ProcessEnv)
    expect(launcher?.command).toBe('C:/engine/hermes.exe')
    expect(launcher?.args).toEqual(['--gateway'])
  })

  it('finds bundled engine under engine-runtime/bin', () => {
    const root = mkdtempSync(join(tmpdir(), 'engine-test-'))
    try {
      mkdirSync(join(root, 'engine-runtime', 'bin'), { recursive: true })
      writeFileSync(join(root, 'engine-runtime', 'bin', 'hermes.exe'), 'x')
      const launcher = resolveEngineLauncher(root, {})
      expect(launcher?.command).toBe(
        join(root, 'engine-runtime', 'bin', 'hermes.exe'),
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns null when no engine is available', () => {
    expect(resolveEngineLauncher('/nonexistent-root', {})).toBeNull()
  })

  it('falls back to hermes on PATH', () => {
    const root = mkdtempSync(join(tmpdir(), 'engine-path-'))
    const binDir = join(root, 'bin')
    try {
      mkdirSync(binDir, { recursive: true })
      const names =
        process.platform === 'win32'
          ? ['hermes.exe', 'hermes.cmd', 'hermes.bat', 'hermes']
          : ['hermes']
      for (const name of names) writeFileSync(join(binDir, name), 'x')
      const launcher = resolveEngineLauncher('/nonexistent-root', {
        PATH: binDir,
      })
      expect(launcher).not.toBeNull()
      // PATH 命中后按绝对路径直接 spawn（非 .cmd/.bat 不套 cmd /c）
      expect(launcher?.command).toBe(join(binDir, names[0]))
      expect(launcher?.args).toEqual(['--gateway'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('respects PATH order and skips empty segments', () => {
    const first = mkdtempSync(join(tmpdir(), 'engine-path-a-'))
    const second = mkdtempSync(join(tmpdir(), 'engine-path-b-'))
    try {
      const name = process.platform === 'win32' ? 'hermes.exe' : 'hermes'
      writeFileSync(join(second, name), 'x')
      const found = resolveFromPath(`;;${first};;${second};;`)
      expect(found).toBe(join(second, name))
    } finally {
      rmSync(first, { recursive: true, force: true })
      rmSync(second, { recursive: true, force: true })
    }
  })
})

describe('waitForEngine', () => {
  it('resolves true once the probe succeeds', async () => {
    let calls = 0
    const probe: EngineHealthProbe = async () => {
      calls += 1
      return { ok: calls >= 3 }
    }
    const ok = await waitForEngine('http://127.0.0.1:8642', {
      timeoutMs: 2_000,
      intervalMs: 10,
      probe,
      sleep: () => Promise.resolve(),
    })
    expect(ok).toBe(true)
    expect(calls).toBeGreaterThanOrEqual(3)
  })

  it('resolves false on timeout', async () => {
    const probe: EngineHealthProbe = async () => ({ ok: false })
    const ok = await waitForEngine('http://127.0.0.1:8642', {
      timeoutMs: 50,
      intervalMs: 10,
      probe,
      sleep: () => Promise.resolve(),
    })
    expect(ok).toBe(false)
  })
})

describe('EngineManager ensure()', () => {
  it('adopts an already-running external gateway (external status)', async () => {
    const manager = new EngineManager({
      probe: async () => ({ ok: true }),
    })
    const info = await manager.ensure()
    expect(info.status).toBe('external')
    await manager.stop()
  })

  it('reports error when no engine binary and gateway is down', async () => {
    const manager = new EngineManager({
      probe: async () => ({ ok: false }),
      readyTimeoutMs: 100,
    })
    const info = await manager.ensure()
    // No engine binary exists in the test env → error with a descriptive message
    expect(info.status).toBe('error')
    expect(info.errorMessage?.length ?? 0).toBeGreaterThan(0)
  })
})
