import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  resolveHermesHome,
  triggerBootstrap,
} from './hermes-bootstrap'

const HERMES_HEALTH_TIMEOUT_MS = 2_000
const HERMES_START_PORT = 8642

let startPromise: Promise<StartHermesAgentResult> | null = null

export type StartHermesAgentResult =
  | {
      ok: true
      message: string
      pid?: number
    }
  | {
      ok: false
      error: string
    }

/**
 * Read <HERMES_HOME>/.env and return key=value pairs as an object.
 * Falls back to ~/.hermes/.env when HERMES_HOME is unset.
 * Silently returns {} if the file doesn't exist or can't be parsed.
 */
function readHermesEnv(): Record<string, string> {
  const envPath = join(resolveHermesHome(), '.env')
  try {
    const raw = readFileSync(envPath, 'utf-8')
    const result: Record<string, string> = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx <= 0) continue
      const key = trimmed.slice(0, eqIdx).trim()
      let value = trimmed.slice(eqIdx + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

/** Same directory resolution logic as vite.config.ts. */
export function resolveHermesAgentDir(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const candidates: Array<string> = []

  if (env.HERMES_AGENT_PATH?.trim()) {
    candidates.push(env.HERMES_AGENT_PATH.trim())
  }

  const workspaceRoot = dirname(resolve('.'))
  candidates.push(
    resolve(workspaceRoot, 'hermes-agent'),
    resolve(workspaceRoot, '..', 'hermes-agent'),
  )

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'webapi'))) return candidate
  }

  return null
}

/** 解析 Hermes 引擎可执行文件（`hermes --gateway`），与 Electron 壳的探测逻辑一致。 */
export function resolveHermesExecutable(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const fromEnv = env.HERMES_ENGINE_BIN?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const pathValue = env.PATH || ''
  const names =
    process.platform === 'win32'
      ? ['hermes.exe', 'hermes.cmd', 'hermes.bat']
      : ['hermes']
  const separator = process.platform === 'win32' ? ';' : ':'
  for (const dir of pathValue.split(separator)) {
    const trimmed = dir.trim()
    if (!trimmed) continue
    for (const name of names) {
      const candidate = resolve(trimmed, name)
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

export function resolveHermesPython(agentDir: string): string {
  if (process.platform === 'win32') {
    const winVenv = resolve(agentDir, '.venv', 'Scripts', 'python.exe')
    if (existsSync(winVenv)) return winVenv
    const winVenv2 = resolve(agentDir, 'venv', 'Scripts', 'python.exe')
    if (existsSync(winVenv2)) return winVenv2
  } else {
    const venvPython = resolve(agentDir, '.venv', 'bin', 'python')
    if (existsSync(venvPython)) return venvPython
    const uvVenv = resolve(agentDir, 'venv', 'bin', 'python')
    if (existsSync(uvVenv)) return uvVenv
  }
  return process.platform === 'win32' ? 'python' : 'python3'
}

export async function isHermesAgentHealthy(
  port = HERMES_START_PORT,
): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(HERMES_HEALTH_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * 一键启动执行引擎（网关）：
 *  1. 已就绪（8642 健康）→ 直接返回成功；
 *  2. 优先 spawn 内置/PATH 中的 hermes 引擎（`hermes --gateway`）；
 *  3. 其次 spawn hermes-agent（Python uvicorn webapi.app:app）；
 *  4. 均不可用 → Windows 下后台自举安装（install.ps1，立即返回"安装进行中"），
 *     其他平台返回友好错误。
 * 全部后台运行（detached），不阻塞请求。
 */
export async function startHermesAgent(): Promise<StartHermesAgentResult> {
  if (await isHermesAgentHealthy()) {
    return { ok: true, message: 'already running' }
  }

  if (startPromise) {
    return startPromise
  }

  startPromise = (async () => {
    try {
      // 1. 优先：hermes 引擎（`hermes --gateway`，与 Electron 壳一致）
      const engineBin = resolveHermesExecutable()
      if (engineBin) {
        const child = spawnEngine(engineBin)
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await new Promise((resolveAttempt) =>
            setTimeout(resolveAttempt, 1_000),
          )
          if (await isHermesAgentHealthy()) {
            return {
              ok: true,
              pid: child.pid,
              message: 'started (engine)',
            }
          }
        }
        return {
          ok: true,
          pid: child.pid,
          message: 'starting (engine)',
        }
      }

      // 2. 其次：hermes-agent（Python 项目）
      const agentDir = resolveHermesAgentDir()
      if (!agentDir) {
        // 3. Windows：后台自举安装 Hermes 执行引擎（install.ps1 → 网关）。
        //    方案 A：fire-and-forget，立即返回"安装进行中"，不阻塞请求；
        //    进度经 GET /api/engine-bootstrap 轮询，前端横幅展示。
        if (process.platform === 'win32') {
          triggerBootstrap()
          return { ok: true, message: 'installing (bootstrap)' }
        }
        return {
          ok: false,
          error:
            '未检测到 Hermes 执行引擎。请先安装执行引擎（hermes），或将 hermes-agent 项目放在本应用同级目录后重启。',
        }
      }

      const python = resolveHermesPython(agentDir)
      const hermesEnv = readHermesEnv()
      const venvBin =
        process.platform === 'win32'
          ? join(agentDir, '.venv', 'Scripts')
          : join(agentDir, '.venv', 'bin')

      const child = spawn(
        python,
        [
          '-m',
          'uvicorn',
          'webapi.app:app',
          '--host',
          '0.0.0.0',
          '--port',
          String(HERMES_START_PORT),
        ],
        {
          cwd: agentDir,
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env,
            ...hermesEnv,
            PATH: `${venvBin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`,
          },
        },
      )

      child.unref()

      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolveAttempt) => setTimeout(resolveAttempt, 1_000))
        if (await isHermesAgentHealthy()) {
          return {
            ok: true,
            pid: child.pid,
            message: 'started',
          }
        }
      }

      return {
        ok: true,
        pid: child.pid,
        message: 'starting',
      }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })()

  try {
    return await startPromise
  } finally {
    startPromise = null
  }
}

/** spawn `hermes --gateway`（后台）。Windows 下 .cmd/.bat 需经 cmd /c 解释。 */
function spawnEngine(engineBin: string): ChildProcess {
  const isWinScript =
    process.platform === 'win32' &&
    /\.(cmd|bat)$/i.test(engineBin) &&
    !engineBin.toLowerCase().endsWith('.exe')
  const [command, args] = isWinScript
    ? (['cmd', ['/c', `"${engineBin}"`, '--gateway']] as const)
    : ([engineBin, ['--gateway']] as const)
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  })
  child.unref()
  return child
}
