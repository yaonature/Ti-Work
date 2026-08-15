/**
 * Electron 壳 —— Hermes 引擎进程生命周期管理（纯逻辑，node 环境可单测）。
 *
 * 职责：探测引擎 → 若 8642/8643 已有健康网关则直接采用（外部引擎/用户自启），
 * 否则从内置运行时 spawn `hermes --gateway` → 健康检查轮询 → 崩溃自动自愈
 * （退避重启，限次）。引擎可用性状态上报给 main.ts 用于托盘/UI。
 *
 * 与 BackendManager（本地 Node 后端）分离：引擎是执行层（Python），
 * 后端是控制层（Node），两者独立生命周期。
 */
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { errorLine, logLine } from './safe-log'

export interface EngineHealthProbe {
  (url: string): Promise<{ ok: boolean }>
}

export interface WaitForEngineOptions {
  timeoutMs: number
  intervalMs: number
  probe: EngineHealthProbe
  sleep?: (ms: number) => Promise<void>
}

export async function waitForEngine(
  url: string,
  opts: WaitForEngineOptions,
): Promise<boolean> {
  const startedAt = Date.now()
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  while (Date.now() - startedAt < opts.timeoutMs) {
    const elapsed = Date.now() - startedAt
    try {
      if ((await opts.probe(url)).ok) return true
    } catch {
      // 探测失败视为未就绪，继续轮询
    }
    await sleep(Math.min(opts.intervalMs, Math.max(0, opts.timeoutMs - elapsed)))
  }
  return false
}

export type EngineStatus = 'idle' | 'external' | 'starting' | 'ready' | 'error'

export interface EngineStatusInfo {
  status: EngineStatus
  url: string
  errorMessage?: string
}

export interface EngineManagerOptions {
  /** Hermes 网关地址（默认 http://127.0.0.1:8642） */
  gatewayUrl?: string
  /** 网关健康探针（注入便于单测） */
  probe?: EngineHealthProbe
  /** 引擎就绪等待时间（默认 60s，首次启动 Python 依赖可能较慢） */
  readyTimeoutMs?: number
  readyIntervalMs?: number
  /** 崩溃自愈：最大自动重启次数（默认 3） */
  maxRestartAttempts?: number
  /** 重启退避基数毫秒（默认 2000，之后 ×2） */
  restartBackoffBaseMs?: number
  onStatusChange?: (info: EngineStatusInfo) => void
}

interface HermesLauncher {
  command: string
  args: Array<string>
  env: Record<string, string>
  cwd: string
}

/**
 * 解析引擎启动命令：
 *  1. 显式环境变量 HERMES_ENGINE_BIN
 *  2. 内置运行时：<projectRoot>/engine-runtime/bin/hermes(.exe|.cmd|.bat)（打包态在 resources/engine-runtime）
 *  3. 系统 PATH 中的 hermes（用户自行安装）
 * 返回 null 表示当前环境无可启动引擎（只能依赖外部已运行网关）。
 */
export function resolveEngineLauncher(
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): HermesLauncher | null {
  const envPath = env.HERMES_ENGINE_BIN?.trim()
  if (envPath) {
    return launcherFor(envPath, projectRoot)
  }

  const candidates = [
    join(projectRoot, 'engine-runtime', 'bin', 'hermes.exe'),
    join(projectRoot, 'engine-runtime', 'bin', 'hermes.cmd'),
    join(projectRoot, 'engine-runtime', 'bin', 'hermes.bat'),
    join(projectRoot, 'engine-runtime', 'bin', 'hermes'),
    join(projectRoot, 'engine-runtime', 'hermes.exe'),
    join(projectRoot, 'engine-runtime', 'hermes.cmd'),
    join(projectRoot, 'engine-runtime', 'hermes.bat'),
    join(projectRoot, 'engine-runtime', 'hermes'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return launcherFor(candidate, projectRoot)
    }
  }

  // 系统 PATH 兜底（开发环境用户已装 hermes）
  const fromPath = resolveFromPath(env.PATH ?? '')
  if (fromPath !== null) {
    return launcherFor(fromPath, projectRoot)
  }

  return null
}

const HERMES_BIN_NAMES = ['hermes.exe', 'hermes.cmd', 'hermes.bat', 'hermes']

/**
 * 按 PATH 顺序查找 hermes 可执行文件（同步、纯 Node，可单测）。
 * 返回第一个存在的绝对路径；未找到返回 null。
 */
export function resolveFromPath(
  pathValue: string,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const names =
    platform === 'win32'
      ? HERMES_BIN_NAMES
      : ['hermes']
  const separator = platform === 'win32' ? ';' : ':'
  for (const dir of pathValue.split(separator)) {
    const trimmed = dir.trim()
    if (trimmed === '') continue
    for (const name of names) {
      const candidate = join(trimmed, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/**
 * 构造启动器命令。Windows 下 .cmd/.bat 无法直接 spawn（需 shell 解释），
 * 统一包装为 `cmd /c "<脚本>" --gateway`，保证与便携 Python 运行时兼容。
 */
function launcherFor(command: string, projectRoot: string): HermesLauncher {
  const isWinScript =
    process.platform === 'win32' &&
    /\.(cmd|bat)$/i.test(command) &&
    !command.toLowerCase().endsWith('.exe')
  if (isWinScript) {
    return {
      command: 'cmd',
      args: ['/c', `"${command}"`, '--gateway'],
      env: {},
      cwd: projectRoot,
    }
  }
  return {
    command,
    args: ['--gateway'],
    env: {},
    cwd: projectRoot,
  }
}

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8642'
const FALLBACK_GATEWAY_URL = 'http://127.0.0.1:8643'

export class EngineManager {
  private readonly gatewayUrl: string
  private readonly fallbackUrl: string
  private readonly probe: EngineHealthProbe
  private readonly readyTimeoutMs: number
  private readonly readyIntervalMs: number
  private readonly maxRestartAttempts: number
  private readonly restartBackoffBaseMs: number
  private readonly onStatusChange: (info: EngineStatusInfo) => void

  private status: EngineStatus = 'idle'
  private errorMessage = ''
  private child: ChildProcess | null = null
  private restartCount = 0
  private stopping = false
  private launcher: HermesLauncher | null = null

  constructor(opts: EngineManagerOptions = {}) {
    this.gatewayUrl = opts.gatewayUrl?.replace(/\/+$/, '') || DEFAULT_GATEWAY_URL
    this.fallbackUrl = FALLBACK_GATEWAY_URL
    this.probe =
      opts.probe ?? ((url) => fetch(url).then((res) => ({ ok: res.ok })))
    this.readyTimeoutMs = opts.readyTimeoutMs ?? 60_000
    this.readyIntervalMs = opts.readyIntervalMs ?? 1_000
    this.maxRestartAttempts = opts.maxRestartAttempts ?? 3
    this.restartBackoffBaseMs = opts.restartBackoffBaseMs ?? 2_000
    this.onStatusChange = opts.onStatusChange ?? (() => {})
  }

  get info(): EngineStatusInfo {
    return {
      status: this.status,
      url: this.gatewayUrl,
      ...(this.errorMessage === '' ? {} : { errorMessage: this.errorMessage }),
    }
  }

  private setStatus(status: EngineStatus, errorMessage = ''): void {
    this.status = status
    this.errorMessage = errorMessage
    logLine(`[engine] ${status}${errorMessage ? ` — ${errorMessage}` : ''}`)
    this.onStatusChange(this.info)
  }

  private async isHealthy(url: string): Promise<boolean> {
    try {
      return (await this.probe(`${url}/health`)).ok
    } catch {
      return false
    }
  }

  /**
   * 确保引擎可用：外部已运行则采用；否则尝试 spawn 内置/系统引擎。
   * 返回是否可用（ready 或 external 视为可用）。
   */
  async ensure(): Promise<EngineStatusInfo> {
    if (this.status === 'ready' || this.status === 'external') {
      return this.info
    }
    // 1. 外部网关已运行（用户手动启动 / 开机自启）——直接采用，不自启
    if (await this.isHealthy(this.gatewayUrl)) {
      this.setStatus('external')
      return this.info
    }
    if (await this.isHealthy(this.fallbackUrl)) {
      this.setStatus('external')
      return this.info
    }
    // 2. 尝试自启内置引擎
    await this.start()
    return this.info
  }

  private async start(): Promise<void> {
    if (this.child !== null) return
    // resolveEngineLauncher 需要 projectRoot —— 通过环境变量注入
    this.launcher = resolveEngineLauncher(
      this.projectRoot(),
      process.env,
    )
    if (this.launcher === null) {
      this.setStatus('error', '未找到 Hermes 引擎可执行文件，且网关未运行')
      return
    }
    this.setStatus('starting')
    this.spawnAndWait(this.launcher)
  }

  private projectRoot(): string {
    // 打包态：引擎运行时经 extraResources 进入 resources/engine-runtime；
    // 开发态：引擎运行时位于项目根 engine-runtime/
    const resourcesPath =
      (process as unknown as { resourcesPath?: string }).resourcesPath ?? ''
    if (resourcesPath) return resourcesPath
    return process.cwd()
  }

  private spawnAndWait(launcher: HermesLauncher): void {
    if (this.stopping) return
    const child = spawn(launcher.command, launcher.args, {
      cwd: launcher.cwd,
      env: { ...process.env, ...launcher.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    child.stdout?.on('data', (chunk) => {
      logLine(`[engine] ${String(chunk).replace(/\r?\n$/, '')}`)
    })
    child.stderr?.on('data', (chunk) => {
      errorLine(`[engine] ${String(chunk).replace(/\r?\n$/, '')}`)
    })
    child.on('error', (err) => {
      this.child = null
      this.setStatus('error', `引擎启动失败：${err.message}`)
    })
    child.on('exit', (code) => {
      const wasCurrent = this.child === child
      this.child = null
      if (this.stopping || !wasCurrent) return
      if (this.status === 'ready') {
        this.handleCrash(code)
      } else if (this.status === 'starting') {
        this.setStatus('error', `引擎启动即退出（code ${code ?? 'unknown'}）`)
      }
    })
    void waitForEngine(this.gatewayUrl, {
      timeoutMs: this.readyTimeoutMs,
      intervalMs: this.readyIntervalMs,
      probe: (url) => this.probe(url).then((res) => ({ ok: res.ok })),
    }).then((ready) => {
      if (this.child !== child) return
      if (ready) {
        this.restartCount = 0
        this.setStatus('ready')
      } else if (!this.stopping) {
        this.setStatus('error', '引擎未在限定时间内就绪')
      }
    })
  }

  private handleCrash(code: number | null): void {
    if (this.stopping) return
    if (this.restartCount >= this.maxRestartAttempts) {
      this.setStatus(
        'error',
        `引擎反复崩溃（已尝试 ${this.maxRestartAttempts} 次重启，最后 code ${code ?? 'unknown'}）`,
      )
      return
    }
    this.restartCount += 1
    const backoff = this.restartBackoffBaseMs * 2 ** (this.restartCount - 1)
    logLine(
      `[engine] 引擎异常退出（code ${code ?? 'unknown'}），${backoff}ms 后第 ${this.restartCount} 次重启`,
    )
    this.setStatus('starting')
    setTimeout(() => {
      if (this.stopping) return
      if (this.launcher === null) {
        this.launcher = resolveEngineLauncher(this.projectRoot(), process.env)
      }
      if (this.launcher === null) {
        this.setStatus('error', '未找到 Hermes 引擎可执行文件，且网关未运行')
        return
      }
      this.spawnAndWait(this.launcher as HermesLauncher)
    }, backoff)
  }

  async stop(): Promise<void> {
    this.stopping = true
    const child = this.child
    this.child = null
    if (child === null) return
    if (this.status !== 'ready') this.setStatus('idle')
    child.kill()
    if (child.exitCode !== null) return
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
  }
}
