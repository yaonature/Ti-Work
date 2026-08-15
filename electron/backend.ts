/**
 * Electron 壳 —— 本地后端进程生命周期管理（纯逻辑，node 环境可单测）。
 *
 * 职责：构造 spawn 命令 → 端口冲突处理 → 健康检查轮询 → 状态上报。
 * 所有网络/进程副作用通过参数注入，main.ts 仅做装配。
 */
import { createServer } from 'node:net'

export interface SpawnSpec {
  command: string
  args: Array<string>
  env: Record<string, string>
  cwd: string
}

export interface BackendEnv {
  /** 优先使用的 node 可执行文件；留空回落系统 PATH 中的 node */
  nodeBin?: string
  /** 打包态优先使用的内置 Electron Runtime（process.execPath） */
  runtimeBin?: string
  projectRoot: string
  port: number
  host: string
  /** 透传给后端进程的额外环境变量（可覆盖 PORT/HOST） */
  extraEnv?: Record<string, string>
}

export function buildSpawnSpec(env: BackendEnv): SpawnSpec {
  const runtimeBin = env.runtimeBin?.trim()
  const nodeBin = env.nodeBin?.trim()
  const useEmbeddedRuntime = Boolean(runtimeBin && runtimeBin.length > 0)
  return {
    command: useEmbeddedRuntime
      ? runtimeBin!
      : nodeBin && nodeBin.length > 0
        ? nodeBin
        : 'node',
    args: ['server-entry.js'],
    env: {
      PORT: String(env.port),
      HOST: env.host,
      ...env.extraEnv,
      ...(useEmbeddedRuntime ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
    },
    cwd: env.projectRoot,
  }
}

/** 健康探测：对后端地址发起一次请求，返回是否就绪 */
export type HealthProbe = (url: string) => Promise<{ ok: boolean }>

export async function isBackendHealthy(
  url: string,
  probe: HealthProbe,
): Promise<boolean> {
  try {
    const res = await probe(url)
    return res.ok
  } catch {
    return false
  }
}

export interface WaitForBackendOptions {
  timeoutMs: number
  intervalMs: number
  probe: HealthProbe
  /** 每次探测（无论成败）后回调已等待毫秒数 */
  onTick?: (elapsedMs: number) => void
  sleep?: (ms: number) => Promise<void>
}

export async function waitForBackend(
  url: string,
  opts: WaitForBackendOptions,
): Promise<boolean> {
  const startedAt = Date.now()
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  while (Date.now() - startedAt < opts.timeoutMs) {
    const elapsed = Date.now() - startedAt
    opts.onTick?.(elapsed)
    if (await isBackendHealthy(url, opts.probe)) return true
    await sleep(Math.min(opts.intervalMs, opts.timeoutMs - elapsed))
  }
  return false
}

/** 端口探测：true 表示该端口可被占用（空闲） */
export type PortProbe = (port: number) => Promise<boolean>

export async function findAvailablePort(
  preferred: number,
  probe: PortProbe,
  maxAttempts: number,
): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = preferred + i
    if (await probe(port)) return port
  }
  throw new Error(
    `no free port found in range ${preferred}-${preferred + maxAttempts - 1}`,
  )
}

/** 真实端口占用探测（node:net 监听回环地址） */
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(true))
    server.listen({ port, host: '127.0.0.1' }, () => {
      server.close(() => resolve(false))
    })
  })
}
