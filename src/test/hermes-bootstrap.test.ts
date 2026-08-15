/**
 * Hermes bootstrap 纯逻辑测试 —— resolveHermesHome / resolveInstalledHermes /
 * resolveInstallerPath / ensureApiServerKey。不触发真实安装，直接跑在 node。
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  defaultHermesHome,
  ensureApiServerKey,
  hydrateProviderConfigFromLegacyEnv,
  resolveHermesHome,
  resolveInstalledHermes,
  resolveInstallerPath,
} from '../server/hermes-bootstrap'

describe('resolveHermesHome', () => {
  it('优先使用 HERMES_HOME 环境变量', () => {
    expect(
      resolveHermesHome({ HERMES_HOME: 'D:\\hermes' }),
    ).toBe('D:\\hermes')
    expect(
      resolveHermesHome({ HERMES_HOME: ' C:\\custom\\hermes ' }),
    ).toBe('C:\\custom\\hermes')
  })

  it('无环境变量时回退到默认值', () => {
    const home = resolveHermesHome({})
    expect(typeof home).toBe('string')
    expect(home.length).toBeGreaterThan(0)
  })

  it('默认值在 Windows 使用 LOCALAPPDATA 下的 Ti Work\\Hermes', () => {
    const home = defaultHermesHome({
      LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local',
    })
    if (process.platform === 'win32') {
      expect(home).toBe('C:\\Users\\tester\\AppData\\Local\\Ti Work\\Hermes')
    } else {
      expect(home).toBe(join(process.env.HOME ?? '', '.ti-work', 'hermes'))
    }
  })
})

describe('resolveInstalledHermes', () => {
  it('命中 venv/Scripts/hermes.exe（Windows 产物结构）', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-home-'))
    try {
      const binDir = join(
        root,
        'hermes-agent',
        'venv',
        'Scripts',
      )
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'hermes.exe'), 'x')
      expect(resolveInstalledHermes(root)).toBe(
        join(binDir, 'hermes.exe'),
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('命中 venv/bin/hermes（POSIX 产物结构）', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-home-'))
    try {
      const binDir = join(root, 'hermes-agent', 'venv', 'bin')
      mkdirSync(binDir, { recursive: true })
      writeFileSync(join(binDir, 'hermes'), 'x')
      expect(resolveInstalledHermes(root)).toBe(
        join(binDir, 'hermes'),
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('未安装时返回 null', () => {
    expect(resolveInstalledHermes('/nonexistent-home')).toBeNull()
  })

  it('命中内置源码快照里的 venv/Scripts/hermes.exe（直接安装模式）', () => {
    const root = mkdtempSync(join(tmpdir(), 'bootstrap-res-'))
    try {
      const sourceDir = join(root, 'hermes-bootstrap', 'hermes-agent-source', 'venv', 'Scripts')
      mkdirSync(sourceDir, { recursive: true })
      writeFileSync(join(sourceDir, 'hermes.exe'), 'x')
      const original = (
        process as unknown as { resourcesPath?: string }
      ).resourcesPath
      ;(process as unknown as { resourcesPath?: string }).resourcesPath = root
      try {
        expect(resolveInstalledHermes('/nonexistent-home')).toBe(
          join(sourceDir, 'hermes.exe'),
        )
      } finally {
        if (original === undefined) {
          delete (
            process as unknown as { resourcesPath?: string }
          ).resourcesPath
        } else {
          ;(process as unknown as { resourcesPath?: string }).resourcesPath =
            original
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('resolveInstallerPath', () => {
  it('优先使用 TIWORK_RESOURCES_PATH 环境变量（Electron 主进程透传）', () => {
    const root = mkdtempSync(join(tmpdir(), 'bootstrap-envres-'))
    try {
      const dir = join(root, 'hermes-bootstrap')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'install.ps1'), 'x')
      expect(
        resolveInstallerPath({ TIWORK_RESOURCES_PATH: root }),
      ).toBe(join(dir, 'install.ps1'))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('优先使用打包版 resources/hermes-bootstrap/install.ps1', () => {
    const root = mkdtempSync(join(tmpdir(), 'bootstrap-res-'))
    try {
      const dir = join(root, 'hermes-bootstrap')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'install.ps1'), 'x')
      const original = (
        process as unknown as { resourcesPath?: string }
      ).resourcesPath
      ;(process as unknown as { resourcesPath?: string }).resourcesPath = root
      try {
        expect(resolveInstallerPath()).toBe(join(dir, 'install.ps1'))
      } finally {
        if (original === undefined) {
          delete (
            process as unknown as { resourcesPath?: string }
          ).resourcesPath
        } else {
          ;(process as unknown as { resourcesPath?: string }).resourcesPath =
            original
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('ensureApiServerKey', () => {
  it('生成 ≥16 位随机 key 并写入 .env', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-env-'))
    try {
      const key = ensureApiServerKey(root)
      expect(key.length).toBeGreaterThanOrEqual(16)
      const envText = require('node:fs').readFileSync(
        join(root, '.env'),
        'utf-8',
      )
      expect(envText).toContain(`API_SERVER_KEY=${key}`)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('已有 ≥16 位 key 时不重写', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-env-'))
    try {
      const existing = 'a'.repeat(32)
      writeFileSync(join(root, '.env'), `OTHER=1\nAPI_SERVER_KEY=${existing}\n`)
      const key = ensureApiServerKey(root)
      expect(key).toBe(existing)
      const envText = require('node:fs').readFileSync(
        join(root, '.env'),
        'utf-8',
      )
      expect(envText.match(/^API_SERVER_KEY=(.*)$/m)?.[1]).toBe(existing)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('已有过短 key 时重新生成', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-env-'))
    try {
      writeFileSync(join(root, '.env'), 'API_SERVER_KEY=short\n')
      const key = ensureApiServerKey(root)
      expect(key.length).toBeGreaterThanOrEqual(16)
      expect(key).not.toBe('short')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('hydrateProviderConfigFromLegacyEnv', () => {
  it('首装时自动继承 legacy .hermes/.env 中的 DeepSeek Key', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-home-'))
    const home = mkdtempSync(join(tmpdir(), 'legacy-home-'))
    const previousHome = process.env.HOME
    const previousUserProfile = process.env.USERPROFILE
    try {
      mkdirSync(join(home, '.hermes'), { recursive: true })
      writeFileSync(
        join(home, '.hermes', '.env'),
        'DEEPSEEK_API_KEY=sk-legacy-key\n',
        'utf-8',
      )
      process.env.HOME = home
      process.env.USERPROFILE = home

      hydrateProviderConfigFromLegacyEnv(root)

      const envText = require('node:fs').readFileSync(
        join(root, '.env'),
        'utf-8',
      )
      expect(envText).toContain('DEEPSEEK_API_KEY=sk-legacy-key')
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousUserProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousUserProfile
      rmSync(root, { recursive: true, force: true })
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('只有 legacy DeepSeek Key 时自动把模板默认模型切到 deepseek-v4-flash', () => {
    const root = mkdtempSync(join(tmpdir(), 'hermes-home-'))
    const home = mkdtempSync(join(tmpdir(), 'legacy-home-'))
    const previousHome = process.env.HOME
    const previousUserProfile = process.env.USERPROFILE
    try {
      mkdirSync(join(home, '.hermes'), { recursive: true })
      writeFileSync(
        join(home, '.hermes', '.env'),
        'DEEPSEEK_API_KEY=sk-legacy-key\n',
        'utf-8',
      )
      writeFileSync(
        join(root, 'config.yaml'),
        [
          'model:',
          '  default: "anthropic/claude-opus-4.6"',
          '  provider: "auto"',
          '  base_url: "https://openrouter.ai/api/v1"',
          '',
        ].join('\n'),
        'utf-8',
      )
      process.env.HOME = home
      process.env.USERPROFILE = home

      hydrateProviderConfigFromLegacyEnv(root)

      const configText = require('node:fs').readFileSync(
        join(root, 'config.yaml'),
        'utf-8',
      )
      expect(configText).toContain('default: deepseek-v4-flash')
      expect(configText).toContain('provider: deepseek')
      expect(configText).toContain('base_url: https://api.deepseek.com/v1')
    } finally {
      if (previousHome === undefined) delete process.env.HOME
      else process.env.HOME = previousHome
      if (previousUserProfile === undefined) delete process.env.USERPROFILE
      else process.env.USERPROFILE = previousUserProfile
      rmSync(root, { recursive: true, force: true })
      rmSync(home, { recursive: true, force: true })
    }
  })
})
