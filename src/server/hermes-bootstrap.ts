import { spawn, spawnSync } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import { request } from 'node:http'
import YAML from 'yaml'
import {
  ENV_PROVIDER_MODELS,
  readEnvValue,
  readEnvValueWithFallback,
  writeEnvValue,
} from './env-models'

/**
 * Hermes 执行引擎 Windows 自举安装（Bootstrap）。
 *
 * 目标：Ti Work 首次启动时自动完成 Hermes 引擎的安装与网关启动，用户无感。
 * 依赖官方 install.ps1 的 Stage 协议（-Manifest 拿阶段清单、-Stage 逐阶段执行
 * 输出 JSON），默认安装到 %LOCALAPPDATA%\Ti Work\Hermes（可用 HERMES_HOME 覆盖），随后：
 *   1) 写入 API_SERVER_KEY（≥16 字符，8642 OpenAI 兼容 API 的前置条件）
 *   2) `hermes gateway install`（schtasks 登录自启 + 崩溃自动重启，env 非交互）
 *   3) 轮询 127.0.0.1:8642/health 就绪
 * 全程幂等：任何一步失败可重入；进程重启后从持久化状态续跑。
 */

const GATEWAY_PORT = 8642
const HEALTH_TIMEOUT_MS = 2_000
const READY_TIMEOUT_MS = 150_000
const STAGE_TIMEOUT_MS = 20 * 60_000
const POLL_INTERVAL_MS = 2_000

export type BootstrapPhase =
  | 'idle'
  | 'detecting'
  | 'installing'
  | 'configuring'
  | 'starting'
  | 'ready'
  | 'failed'

/**
 * 失败/引导分类（规划 5.2-4：首启失败需可区分）。
 *  - install-failed    执行引擎未装好（安装器未跑 / 阶段失败）
 *  - gateway-not-ready 引擎已装好，但网关未启动或健康检查不通过
 *  - config-needed     网关已就绪，但缺少模型 API Key（由 UI 依据配置状态判定）
 *  - config-invalid    网关已就绪，但模型配置无效（由 UI 依据聊天探测判定）
 */
export type FailureCategory =
  | 'install-failed'
  | 'gateway-not-ready'
  | 'config-needed'
  | 'config-invalid'

export type PreparedBy = 'installer' | 'first-launch'

export type BootstrapStageInfo = {
  name: string
  title: string
  category: string
  needsUserInput: boolean
}

export type BootstrapState = {
  phase: BootstrapPhase
  hermesHome: string
  stages: BootstrapStageInfo[]
  stageIndex: number
  message: string
  error: string | null
  hermesBin: string | null
  attempt: number
  startedAt: number | null
  finishedAt: number | null
  /** 失败/引导分类：区分安装失败、网关未就绪（规划 5.2-4） */
  failureCategory: FailureCategory | null
  /** 引擎产物由谁准备：安装器预装 or 首启自举（null=未知/未准备） */
  preparedBy: PreparedBy | null
}

const INITIAL_STATE: BootstrapState = {
  phase: 'idle',
  hermesHome: '',
  stages: [],
  stageIndex: -1,
  message: '',
  error: null,
  hermesBin: null,
  attempt: 0,
  startedAt: null,
  finishedAt: null,
  failureCategory: null,
  preparedBy: null,
}

let runningPromise: Promise<BootstrapState> | null = null

/** 默认 HERMES_HOME：用户级应用数据目录，避免写入固定盘符根目录。 */
export function defaultHermesHome(
  env: Record<string, string | undefined> = process.env,
): string {
  if (process.platform === 'win32') {
    const localAppData = env.LOCALAPPDATA?.trim()
    if (localAppData) return join(localAppData, 'Ti Work', 'Hermes')
  }
  return join(homedir(), '.ti-work', 'hermes')
}

/** 解析 HERMES_HOME：环境变量 → 用户级应用数据目录。 */
export function resolveHermesHome(
  env: Record<string, string | undefined> = process.env,
): string {
  const fromEnv = env.HERMES_HOME?.trim()
  if (fromEnv) return fromEnv
  return defaultHermesHome(env)
}

function resolveManagedWritableDir(hermesHome: string): string {
  const candidates = [
    join(hermesHome, 'AppData'),
    join(hermesHome, 'bin'),
    hermesHome,
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return hermesHome
}

function stateFilePath(hermesHome = resolveHermesHome()): string {
  return join(resolveManagedWritableDir(hermesHome), '.tiwork-bootstrap.json')
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function traceBootstrap(message: string): void {
  try {
    appendFileSync(
      join(tmpdir(), 'tiwork-bootstrap-debug.log'),
      `${new Date().toISOString()} ${message}\n`,
      'utf-8',
    )
  } catch {
    /* debug trace must never break bootstrap */
  }
}

function runPowerShellSync(command: string): boolean {
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    {
      windowsHide: true,
      encoding: 'utf-8',
    },
  )
  if (result.status === 0) return true
  const stderr = result.stderr?.trim() || '(empty)'
  console.error(`[bootstrap] powershell fallback failed:\n${stderr}`)
  return false
}

async function runRobocopyMirrorAsync(source: string, destination: string): Promise<boolean> {
  const result = await runProcess(
    'robocopy',
    [
      source,
      destination,
      '/MIR',
      '/R:1',
      '/W:1',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
    ],
    { timeoutMs: 10 * 60_000 },
  )
  const code = result.code
  if (code >= 0 && code <= 7) return true
  const stderr = result.stderr.trim() || '(empty)'
  const stdout = result.stdout.trim() || '(empty)'
  console.error(
    `[bootstrap] robocopy fallback failed exit=${code}\nstdout:\n${stdout}\n--- stderr ---\n${stderr}`,
  )
  return false
}

function runRobocopyMirror(source: string, destination: string): boolean {
  const result = spawnSync(
    'robocopy',
    [
      source,
      destination,
      '/MIR',
      '/R:1',
      '/W:1',
      '/NFL',
      '/NDL',
      '/NJH',
      '/NJS',
      '/NP',
    ],
    {
      windowsHide: true,
      encoding: 'utf-8',
    },
  )
  const code = result.status ?? 999
  if (code <= 7) return true
  const stderr = result.stderr?.trim() || '(empty)'
  const stdout = result.stdout?.trim() || '(empty)'
  console.error(
    `[bootstrap] robocopy fallback failed exit=${code}\nstdout:\n${stdout}\n--- stderr ---\n${stderr}`,
  )
  return false
}

/** 内存态：saveState 每次更新，供 UI 轮询读取（磁盘持久化失败时进度依然可见） */
let latestState: BootstrapState | null = null

export function getBootstrapState(): BootstrapState {
  const hermesHome = resolveHermesHome()
  try {
    const raw = readFileSync(stateFilePath(hermesHome), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<BootstrapState>
    return { ...INITIAL_STATE, hermesHome, ...parsed }
  } catch {
    return { ...INITIAL_STATE, hermesHome }
  }
}

/** 实时状态：优先内存（正在进行的安装），无则读磁盘 */
export function getLiveBootstrapState(): BootstrapState {
  if (latestState) return latestState
  return getBootstrapState()
}

async function reconcileReadyState(state: BootstrapState): Promise<BootstrapState> {
  if (state.phase !== 'ready') return state
  if (await isGatewayHealthy()) return state

  const nextState: BootstrapState = {
    ...state,
    phase: 'idle',
    message: '执行引擎连接已丢失，准备重新检测…',
    error: null,
    finishedAt: null,
  }
  traceBootstrap('[state] stale ready detected; gateway unhealthy -> idle')
  saveState(nextState)
  return nextState
}

export async function getValidatedBootstrapState(): Promise<BootstrapState> {
  return reconcileReadyState(getLiveBootstrapState())
}

function saveState(state: BootstrapState): void {
  latestState = { ...state }
  try {
    mkdirSync(dirname(stateFilePath(state.hermesHome)), { recursive: true })
    writeFileSync(
      stateFilePath(state.hermesHome),
      JSON.stringify(state, null, 2),
      'utf-8',
    )
  } catch (error) {
    // 持久化失败不阻塞主流程，但必须可诊断（否则状态停滞无法排查）
    console.error('[bootstrap] saveState failed:', error)
    try {
      const filePath = stateFilePath(state.hermesHome)
      const payload = Buffer.from(
        JSON.stringify(state, null, 2),
        'utf-8',
      ).toString('base64')
      runPowerShellSync(
        [
          `$dir = ${quotePowerShellLiteral(dirname(filePath))}`,
          `$file = ${quotePowerShellLiteral(filePath)}`,
          `$bytes = [Convert]::FromBase64String(${quotePowerShellLiteral(payload)})`,
          `New-Item -ItemType Directory -Force -Path $dir | Out-Null`,
          `[IO.File]::WriteAllBytes($file, $bytes)`,
        ].join('; '),
      )
    } catch (fallbackError) {
      console.error('[bootstrap] saveState powershell fallback failed:', fallbackError)
    }
  }
}

/** 打包版安装器路径（extraResources/hermes-bootstrap/install.ps1）。 */
export function resolveInstallerPath(
  env: Record<string, string | undefined> = process.env,
): string | null {
  // 1) Electron 主进程注入：server 是纯 Node 子进程，无 process.resourcesPath，
  //    由 main.ts 通过 TIWORK_RESOURCES_PATH 透传打包资源目录（resources/）。
  const envResources = env.TIWORK_RESOURCES_PATH?.trim()
  if (envResources) {
    const packaged = join(envResources, 'hermes-bootstrap', 'install.ps1')
    if (existsSync(packaged)) return packaged
  }
  // 2) Electron 主进程内直接执行时（未走 env 透传）
  const resourcesPath = (
    process as unknown as { resourcesPath?: string }
  ).resourcesPath
  if (typeof resourcesPath === 'string') {
    const packaged = join(resourcesPath, 'hermes-bootstrap', 'install.ps1')
    if (existsSync(packaged)) return packaged
  }
  const devPath = join(process.cwd(), '.bootstrap-stage', 'install.ps1')
  if (existsSync(devPath)) return devPath
  const cachePath = join(
    tmpdir(),
    'tiwork-hermes-bootstrap',
    'install.ps1',
  )
  if (existsSync(cachePath)) return cachePath
  return null
}

function resolveDirectInstallDir(
  env: Record<string, string | undefined> = process.env,
): string | null {
  return resolveBundledSourceSnapshotPath(env)
}

/** bootstrap 安装产物中的 hermes 命令。 */
export function resolveInstalledHermes(
  hermesHome = resolveHermesHome(),
): string | null {
  const installDirs = [
    join(hermesHome, 'hermes-agent'),
    resolveDirectInstallDir(),
  ].filter((value): value is string => Boolean(value))

  for (const installDir of installDirs) {
    const candidates = [
      join(installDir, 'venv', 'Scripts', 'hermes.exe'),
      join(installDir, 'venv', 'bin', 'hermes'),
      join(installDir, '.venv', 'Scripts', 'hermes.exe'),
    ]
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/** 打包内置的 Hermes 源码快照（resources/hermes-bootstrap/hermes-agent-source）。 */
export function resolveBundledSourceSnapshotPath(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const envResources = env.TIWORK_RESOURCES_PATH?.trim()
  if (envResources) {
    const packaged = join(envResources, 'hermes-bootstrap', 'hermes-agent-source')
    if (existsSync(packaged)) return packaged
  }
  const resourcesPath = (
    process as unknown as { resourcesPath?: string }
  ).resourcesPath
  if (typeof resourcesPath === 'string') {
    const packaged = join(resourcesPath, 'hermes-bootstrap', 'hermes-agent-source')
    if (existsSync(packaged)) return packaged
  }
  const devPath = join(process.cwd(), '.bootstrap-stage', 'hermes-agent-source')
  if (existsSync(devPath)) return devPath
  return null
}

async function seedBundledSourceSnapshot(
  snapshotPath: string,
  hermesHome: string,
): Promise<void> {
  const installDir = join(hermesHome, 'hermes-agent')
  traceBootstrap(`[snapshot] seed start source=${snapshotPath} dest=${installDir}`)
  // 这是受管安装目录。若此前在 repository 阶段失败，目录里可能残留半截 clone；
  // 既然本次已携带固定源码快照，就直接覆盖为干净快照，避免沿用坏目录。
  mkdirSync(dirname(installDir), { recursive: true })

  if (process.platform === 'win32' && (await runRobocopyMirrorAsync(snapshotPath, installDir))) {
    traceBootstrap('[snapshot] robocopy copy ok')
    return
  }

  try {
    rmSync(installDir, { recursive: true, force: true })
    mkdirSync(dirname(installDir), { recursive: true })
    cpSync(snapshotPath, installDir, { recursive: true, force: true })
    traceBootstrap('[snapshot] fs copy ok')
    return
  } catch (error) {
    console.error('[bootstrap] seedBundledSourceSnapshot fs copy failed:', error)
    traceBootstrap(
      `[snapshot] fs copy failed error=${error instanceof Error ? error.message : String(error)}`,
    )
    const ok = runPowerShellSync(
      [
        `$src = ${quotePowerShellLiteral(snapshotPath)}`,
        `$dest = ${quotePowerShellLiteral(installDir)}`,
        `$parent = ${quotePowerShellLiteral(dirname(installDir))}`,
        `Remove-Item -Recurse -Force -LiteralPath $dest -ErrorAction SilentlyContinue`,
        `New-Item -ItemType Directory -Force -Path $parent | Out-Null`,
        `Copy-Item -Recurse -Force -LiteralPath $src -Destination $dest`,
      ].join('; '),
    )
    if (!ok) {
      traceBootstrap('[snapshot] all copy strategies failed')
      throw error
    }
    traceBootstrap('[snapshot] fallback copy ok')
  }
}

async function isGatewayHealthy(): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const req = request(
      {
        hostname: '127.0.0.1',
        port: GATEWAY_PORT,
        path: '/health',
        method: 'GET',
        timeout: HEALTH_TIMEOUT_MS,
      },
      (response) => {
        response.resume()
        resolvePromise(Boolean(response.statusCode && response.statusCode >= 200 && response.statusCode < 300))
      },
    )
    req.on('timeout', () => {
      req.destroy()
      resolvePromise(false)
    })
    req.on('error', () => resolvePromise(false))
    req.end()
  })
}

function runProcess(
  command: string,
  args: string[],
  opts: { env?: Record<string, string>; timeoutMs?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...opts.env },
      // 显式管道：避免未定义 stdio 时 Windows 下管道缓冲行为不一致导致卡死
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    // 超大输出只保留首尾，避免内存膨胀
    let stdout = ''
    let stderr = ''
    const MAX_CAPTURE = 256 * 1024
    let settled = false
    const settle = (result: {
      code: number
      stdout: string
      stderr: string
    }): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolvePromise(result)
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* already exited */
      }
      // 进程被 kill 后若仍未触发 close（极端挂死），5 秒后强制收尾
      setTimeout(() => {
        settle({ code: -1, stdout, stderr: 'process timeout' })
      }, 5_000)
    }, opts.timeoutMs ?? STAGE_TIMEOUT_MS)
    child.stdout?.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_CAPTURE) stdout += chunk.toString('utf-8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_CAPTURE) stderr += chunk.toString('utf-8')
    })
    child.on('exit', (code) => {
      settle({ code: code ?? -1, stdout, stderr })
    })
    child.on('close', (code) => {
      settle({ code: code ?? -1, stdout, stderr })
    })
    child.on('error', (error) => {
      settle({ code: -1, stdout, stderr: String(error) })
    })
  })
}

function powershellArgs(
  installerPath: string,
  hermesHome: string,
  installDir: string,
  extra: string[],
): string[] {
  return [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    installerPath,
    ...extra,
    '-HermesHome',
    hermesHome,
    '-InstallDir',
    installDir,
  ]
}

/**
 * 官方 install.ps1 的 repository 阶段会执行 `git config --global ...`。
 * 某些受限 Windows 环境下，用户目录（C:\Users\...\ .gitconfig）不可写，
 * 会导致首次安装卡死在 "Cloning Hermes repository"。
 *
 * 这里把 Git 的 global config 显式重定向到 HERMES_HOME 内部。
 * 生产包不应进入 repository 阶段；该环境隔离仅作为官方安装器阶段的兜底约束。
 */
function buildBootstrapEnv(hermesHome: string): Record<string, string> {
  mkdirSync(hermesHome, { recursive: true })
  const writableDir = resolveManagedWritableDir(hermesHome)
  const gitConfigGlobal = join(writableDir, '.gitconfig')
  return {
    HERMES_HOME: hermesHome,
    HOME: hermesHome,
    USERPROFILE: hermesHome,
    XDG_CONFIG_HOME: writableDir,
    GIT_CONFIG_GLOBAL: gitConfigGlobal,
  }
}

function parseLastJsonLine(stdout: string): Record<string, unknown> | null {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(lines[i]) as Record<string, unknown>
    } catch {
      /* keep scanning for the JSON frame */
    }
  }
  return null
}

/** 读取安装阶段清单（-Manifest）。 */
async function fetchStageManifest(
  installerPath: string,
  hermesHome: string,
  installDir: string,
): Promise<BootstrapStageInfo[]> {
  traceBootstrap(
    `[manifest] start installer=${installerPath} hermesHome=${hermesHome} installDir=${installDir}`,
  )
  const result = spawnSync(
    'powershell.exe',
    powershellArgs(installerPath, hermesHome, installDir, ['-Manifest']),
    {
      env: { ...process.env, ...buildBootstrapEnv(hermesHome) },
      windowsHide: true,
      encoding: 'utf-8',
      timeout: 60_000,
    },
  )
  traceBootstrap(
    `[manifest] done status=${result.status ?? 'null'} signal=${result.signal ?? 'null'} error=${result.error ? String(result.error) : 'null'}`,
  )
  const code = result.status ?? (result.error ? -1 : 0)
  const stdout = result.stdout ?? ''
  const stderr = result.stderr ?? ''
  if (code !== 0) {
    throw new Error(
      `读取安装清单失败（exit ${code}）：${stderr.trim() || stdout.trim().slice(-300) || '未知错误'}`,
    )
  }
  const parsed = parseLastJsonLine(stdout)
  traceBootstrap(
    `[manifest] parsed stages=${Array.isArray(parsed?.stages) ? parsed.stages.length : 0}`,
  )
  const stages = Array.isArray(parsed?.stages)
    ? (parsed.stages as Array<{
        name?: string
        title?: string
        category?: string
        needs_user_input?: boolean
      }>)
    : []
  return stages.map((stage) => ({
    name: stage.name ?? 'unknown',
    title: stage.title ?? stage.name ?? 'unknown',
    category: stage.category ?? 'install',
    needsUserInput: Boolean(stage.needs_user_input),
  }))
}

/** 执行单个安装阶段（-Stage <name>），返回是否成功/跳过。 */
async function runInstallStage(
  installerPath: string,
  hermesHome: string,
  installDir: string,
  stageName: string,
): Promise<{ ok: boolean; skipped: boolean; reason?: string }> {
  const { code, stdout, stderr } = await runProcess(
    'powershell.exe',
    powershellArgs(installerPath, hermesHome, installDir, [
      '-Stage',
      stageName,
      '-NonInteractive',
    ]),
    { env: buildBootstrapEnv(hermesHome) },
  )
  const parsed = parseLastJsonLine(stdout)
  if (code === 0) {
    return {
      ok: true,
      skipped: Boolean(parsed?.skipped),
      reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
    }
  }
  const stdoutTail = stdout.trim().slice(-1200)
  const stderrTail = stderr.trim().slice(-1200)
  console.error(
    `[bootstrap] raw stage failure stage=${stageName} exit=${code}\nstdout:\n${stdoutTail || '(empty)'}\n--- stderr ---\n${stderrTail || '(empty)'}`,
  )
  return {
    ok: false,
    skipped: false,
    reason:
      typeof parsed?.reason === 'string'
        ? parsed.reason
        : stderr.trim() || `阶段 ${stageName} 失败（exit ${code}）`,
  }
}

/** 确保 HERMES_HOME/.env 中存在 ≥16 位的 API_SERVER_KEY，返回该 key。 */
export function ensureApiServerKey(hermesHome: string): string {
  const envPath = join(hermesHome, '.env')
  let envText = ''
  if (existsSync(envPath)) {
    envText = readFileSync(envPath, 'utf-8')
  }
  const match = envText.match(/^API_SERVER_KEY=(.*)$/m)
  if (match && match[1].trim().length >= 16) {
    return match[1].trim()
  }
  const key = randomBytes(24).toString('hex')
  const separator = envText && !envText.endsWith('\n') ? '\n' : ''
  writeFileSync(
    envPath,
    `${envText}${separator}API_SERVER_KEY=${key}\n`,
    'utf-8',
  )
  return key
}

function importLegacyProviderKeys(hermesHome: string): void {
  const envPath = join(hermesHome, '.env')
  for (const provider of ENV_PROVIDER_MODELS) {
    if (readEnvValue(envPath, provider.envKey)) continue
    const legacyValue = readEnvValueWithFallback(provider.envKey, envPath)
    if (!legacyValue) continue
    writeEnvValue(envPath, provider.envKey, legacyValue)
    if (readEnvValue(envPath, provider.envKey)) {
      traceBootstrap(`[provider-env] imported ${provider.envKey} from legacy env`)
    }
  }
}

function hydrateDefaultModelConfig(hermesHome: string): void {
  const envPath = join(hermesHome, '.env')
  const configPath = join(hermesHome, 'config.yaml')
  const deepseekKey = readEnvValue(envPath, 'DEEPSEEK_API_KEY')
  if (!deepseekKey) return

  let config: Record<string, unknown> = {}
  try {
    if (existsSync(configPath)) {
      config = (YAML.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>) || {}
    }
  } catch {
    config = {}
  }

  const model =
    config.model && typeof config.model === 'object' && !Array.isArray(config.model)
      ? ({ ...(config.model as Record<string, unknown>) })
      : {}

  const currentDefault = String(model.default ?? model.model ?? '').trim()
  const currentProvider = String(model.provider ?? '').trim()
  const currentBaseUrl = String(model.base_url ?? '').trim()
  const hasCompetingKey = Boolean(
    readEnvValue(envPath, 'OPENROUTER_API_KEY') ||
      readEnvValue(envPath, 'ANTHROPIC_API_KEY') ||
      readEnvValue(envPath, 'OPENAI_API_KEY'),
  )
  const usingTemplateDefaults =
    (currentDefault === '' || currentDefault === 'anthropic/claude-opus-4.6') &&
    (currentProvider === '' || currentProvider === 'auto') &&
    (currentBaseUrl === '' || currentBaseUrl === 'https://openrouter.ai/api/v1')

  if (!usingTemplateDefaults || hasCompetingKey) return

  model.default = 'deepseek-v4-flash'
  model.provider = 'deepseek'
  model.base_url = 'https://api.deepseek.com/v1'
  config.model = model
  writeFileSync(configPath, YAML.stringify(config), 'utf-8')
  traceBootstrap('[provider-config] promoted default model to DeepSeek V4 Flash')
}

export function hydrateProviderConfigFromLegacyEnv(hermesHome: string): void {
  importLegacyProviderKeys(hermesHome)
  hydrateDefaultModelConfig(hermesHome)
}

/** 注册网关：登录自启 + 立即启动（env 变量实现非交互）。 */
async function installGatewayService(
  hermesBin: string,
  hermesHome: string,
): Promise<void> {
  const { code, stdout, stderr } = await runProcess(hermesBin, ['gateway', 'install'], {
    env: {
      HERMES_HOME: hermesHome,
      HERMES_GATEWAY_INSTALL_START_NOW: '1',
      HERMES_GATEWAY_INSTALL_START_ON_LOGIN: '1',
    },
    timeoutMs: 3 * 60_000,
  })
  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim().slice(-400)
    throw new Error(
      `注册网关服务失败（exit ${code}）${detail ? `：${detail}` : ''}`,
    )
  }
}

/** 降级启动：后台 detached 运行 hermes gateway（不自启，仅当前会话可用）。 */
function spawnGatewayFallback(hermesBin: string, hermesHome: string): ChildProcess {
  const child = spawn(hermesBin, ['gateway'], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, HERMES_HOME: hermesHome },
  })
  child.unref()
  return child
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function waitUntilHealthy(
  timeoutMs = READY_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isGatewayHealthy()) return true
    await sleep(POLL_INTERVAL_MS)
  }
  return false
}

/**
 * 触发一次自举安装。幂等：
 *  - 8642 已健康 → 直接 ready；
 *  - 已有 hermes 产物（HERMES_HOME）→ 跳过安装，直接配网关；
 *  - 否则逐阶段执行官方 install.ps1 → 写 API_SERVER_KEY → hermes gateway install。
 * 并发调用共享同一个 Promise；进度可经 getBootstrapState() 轮询。
 */
export function runBootstrap(): Promise<BootstrapState> {
  if (runningPromise) return runningPromise
  runningPromise = doRun().finally(() => {
    runningPromise = null
  })
  return runningPromise
}

/**
 * 后台触发自举安装（fire-and-forget，不等待安装完成）。
 * 用于方案 A：应用打开即可用，引擎安装转入后台，进度经 getBootstrapState() 轮询。
 * 幂等：安装已在跑则复用；失败后允许立即重试，避免用户点击“重试”无响应。
 */
export function triggerBootstrap(): void {
  if (runningPromise) return
  void runBootstrap().catch((error) => {
    console.error('[bootstrap] runBootstrap rejected:', error)
  })
}

async function doRun(): Promise<BootstrapState> {
  const state = getBootstrapState()
  const hermesHome = state.hermesHome || resolveHermesHome()
  traceBootstrap(
    `[doRun] start phase=${state.phase} attempt=${state.attempt} stageIndex=${state.stageIndex} hermesHome=${hermesHome}`,
  )
  console.log(
    `[bootstrap] doRun start phase=${state.phase} attempt=${state.attempt} stageIndex=${state.stageIndex} hermesHome=${hermesHome}`,
  )

  // 已 ready 但网关健康丢了 → 重置重跑
  if (state.phase === 'ready' && !(await isGatewayHealthy())) {
    state.phase = 'idle'
  }
  if (state.phase === 'ready') {
    state.message = '执行引擎已在运行'
    return state
  }

  // 续跑：上次 installing 中断时保留阶段进度
  if (state.phase !== 'installing') {
    state.phase = 'detecting'
    state.attempt += 1
    state.error = null
    state.failureCategory = null
    state.startedAt = state.startedAt ?? Date.now()
    state.finishedAt = null
    state.stageIndex = -1
  }
  state.hermesHome = hermesHome
  saveState(state)

  // 1. 首装路径不做前置网关健康检查：部分打包/沙箱环境会在 127.0.0.1 探测处卡死。
  //    是否 ready 由已安装产物配置网关后的 waitUntilHealthy 负责判断。

  // 2. 已有 hermes 产物 → 跳过安装，直接配置网关
  traceBootstrap('[doRun] before resolveInstalledHermes')
  let hermesBin = resolveInstalledHermes(hermesHome)
  traceBootstrap(`[doRun] resolveInstalledHermes result=${hermesBin ?? 'null'}`)
  if (!hermesBin) {
    // 3. 无安装器 → 无法自举
    const installerPath = resolveInstallerPath()
    if (!installerPath) {
      state.phase = 'failed'
      state.error =
        '未找到 Hermes 安装器（install.ps1）。请检查安装包完整性，或联网后重试。'
      state.failureCategory = 'install-failed'
      state.finishedAt = Date.now()
      saveState(state)
      return state
    }
    // 固定版本策略：必须使用安装包内置源码快照。
    // 这里直接把内置源码目录作为 InstallDir 跑安装阶段，不再先复制一份到 HERMES_HOME。
    // repository 阶段仍保持跳过，避免任何 git / 网络回退。
    const bundledSource = resolveBundledSourceSnapshotPath()
    if (!bundledSource) {
      state.phase = 'failed'
      state.message = '未找到安装包内置的 Hermes 固定版本源码'
      state.error =
        '未找到 hermes-agent-source。当前安装包不完整，无法保证按固定版本安装执行引擎。'
      state.failureCategory = 'install-failed'
      state.finishedAt = Date.now()
      saveState(state)
      traceBootstrap('[doRun] bundled source missing -> failed')
      return state
    }
    const installDir = bundledSource

    // 4. 读取阶段清单
    state.phase = 'installing'
    state.message = '正在读取安装清单…'
    saveState(state)
    traceBootstrap('[doRun] before fetchStageManifest')
    let stages: BootstrapStageInfo[]
    try {
      stages = await fetchStageManifest(installerPath, hermesHome, installDir)
      traceBootstrap(`[doRun] fetched manifest stages=${stages.length}`)
    } catch (error) {
      traceBootstrap(
        `[doRun] fetchStageManifest failed error=${error instanceof Error ? error.message : String(error)}`,
      )
      state.phase = 'failed'
      state.error = error instanceof Error ? error.message : String(error)
      state.failureCategory = 'install-failed'
      state.finishedAt = Date.now()
      saveState(state)
      return state
    }
    if (stages.length === 0) {
      state.phase = 'failed'
      state.error = '安装清单为空，无法继续。'
      state.failureCategory = 'install-failed'
      state.finishedAt = Date.now()
      saveState(state)
      return state
    }
    console.log(`[bootstrap] direct install from bundled source: ${bundledSource}`)
    traceBootstrap(`[doRun] direct install using bundled source installDir=${installDir}`)
    const autoStages = stages.filter(
      (stage) =>
        !stage.needsUserInput &&
        stage.name !== 'repository',
    )
    state.stages = autoStages
    saveState(state)

    // 5. 逐阶段安装（续跑从上次进度继续）
    const startIndex = Math.max(0, state.stageIndex)
    console.log(`[bootstrap] install stages=${autoStages.length} startIndex=${startIndex}`)
    for (let i = startIndex; i < autoStages.length; i += 1) {
      const stage = autoStages[i]
      state.stageIndex = i
      state.message = stage.title
      saveState(state)
      console.log(`[bootstrap] stage ${i + 1}/${autoStages.length} start: ${stage.name}`)
      let result = await runInstallStage(
        installerPath,
        hermesHome,
        installDir,
        stage.name,
      )
      // Windows 首装现场中，venv 阶段偶发首次失败、随后立刻重跑成功。
      // 证据：同一命令在失败后手动复跑可稳定通过。这里做受控重试，
      // 避免把瞬时环境抖动直接暴露给用户。
      if (!result.ok && stage.name === 'venv') {
        for (let retry = 1; retry <= 2 && !result.ok; retry += 1) {
          console.warn(
            `[bootstrap] stage ${i + 1}/${autoStages.length} retry ${retry}/2: ${stage.name} reason=${result.reason}`,
          )
          await sleep(3_000 * retry)
          result = await runInstallStage(
            installerPath,
            hermesHome,
            installDir,
            stage.name,
          )
        }
      }
      if (!result.ok) {
        console.error(`[bootstrap] stage ${i + 1}/${autoStages.length} FAILED: ${stage.name} reason=${result.reason}`)
        state.phase = 'failed'
        state.error =
          result.reason ||
          `安装阶段「${stage.title}」失败，可稍后重试。`
        state.failureCategory = 'install-failed'
        state.finishedAt = Date.now()
        saveState(state)
        return state
      }
      console.log(`[bootstrap] stage ${i + 1}/${autoStages.length} done: ${stage.name} skipped=${result.skipped}`)
    }
    state.stageIndex = autoStages.length

    hermesBin = resolveInstalledHermes(hermesHome)
    if (!hermesBin) {
      state.phase = 'failed'
      state.error = '引擎已安装，但未找到 hermes 命令，无法继续。'
      state.failureCategory = 'install-failed'
      state.finishedAt = Date.now()
      saveState(state)
      return state
    }
  }

  state.hermesBin = hermesBin

  // 6. 配置 API_SERVER_KEY（8642 OpenAI 兼容 API 的前置条件）
  state.phase = 'configuring'
  state.message = '正在配置网关密钥…'
  saveState(state)
  try {
    ensureApiServerKey(hermesHome)
    hydrateProviderConfigFromLegacyEnv(hermesHome)
  } catch (error) {
    state.phase = 'failed'
    state.error = `写入网关密钥失败：${error instanceof Error ? error.message : String(error)}`
    state.failureCategory = 'install-failed'
    state.finishedAt = Date.now()
    saveState(state)
    return state
  }

  // 7. 启动网关（登录自启 + 立即启动）
  state.phase = 'starting'
  state.message = '正在启动执行引擎网关…'
  saveState(state)
  try {
    await installGatewayService(hermesBin, hermesHome)
  } catch {
    // 降级：后台运行（当前会话可用，自启缺失）
    spawnGatewayFallback(hermesBin, hermesHome)
  }

  // 8. 轮询就绪
  const ready = await waitUntilHealthy()
  if (ready) {
    state.phase = 'ready'
    state.message = '执行引擎已启动'
    state.finishedAt = Date.now()
    saveState(state)
    console.log('[bootstrap] gateway healthy → ready')
    return state
  }

  state.phase = 'failed'
  state.error =
    '执行引擎进程已启动，但网关未就绪。请稍后点击「重试」，或在设置中检查 HERMES_HOME 配置。'
  state.failureCategory = 'gateway-not-ready'
  state.finishedAt = Date.now()
  saveState(state)
  console.error('[bootstrap] gateway not healthy after wait → failed')
  return state
}
