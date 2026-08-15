/**
 * Electron 主进程 —— Ti Work 桌面壳装配。
 *
 * 职责：
 *  - 单实例锁；常驻系统托盘（关闭窗口隐藏而非退出）
 *  - 本地后端进程生命周期：端口冲突扫描 → spawn → 健康检查轮询 → 就绪后加载
 *  - 托盘菜单（显示/重启服务/开机自启/退出）、开机自启、原生通知
 *  - 自动更新：按 TI_WORK_UPDATE_URL 拉取 latest.json 版本比对（未配置则跳过）
 *  - IPC：向渲染进程暴露壳信息 / 自启开关 / 后端重启与状态推送
 *
 * 纯逻辑（端口/命令构造/健康轮询/版本判定/状态机）收敛于 config/backend/updater/update-check，
 * 本文件仅做装配；编译产物为 dist-electron/main.cjs（esbuild 单文件，external electron）。
 */
import { spawn } from 'node:child_process'
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  ipcMain,
  nativeImage,
} from 'electron'
import {
  buildSpawnSpec,
  findAvailablePort,
  isPortInUse,
  waitForBackend,
} from './backend'
import {
  APP_ID,
  APP_NAME,
  BACKEND_PROBE_INTERVAL_MS,
  BACKEND_READY_TIMEOUT_MS,
  DEFAULT_BACKEND_HOST,
  DEFAULT_BACKEND_PORT,
  MAX_BACKEND_PORT_ATTEMPTS,
  UPDATE_CHECK_INTERVAL_MS,
  backendUrl,
  buildTrayMenuTemplate,
  buildWindowOptions,
} from './config'
import { TRAY_ICON_DATA_URL } from './tray-icon'
import { EngineManager } from './hermes-engine'
import type { EngineStatusInfo } from './hermes-engine'
import { fetchUpdateManifest } from './update-check'
import { isNewerVersion, nextUpdateState, shouldCheckForUpdates } from './updater'
import type { TrayMenuAction } from './config'
import type { UpdateManifest } from './update-check'
import type { UpdateState } from './updater'
import { errorLine, logLine } from './safe-log'

try {
  appendFileSync(
    join(tmpdir(), 'tiwork-main-debug.log'),
    `${new Date().toISOString()} [startup] module loaded\n`,
    'utf-8',
  )
} catch {
  /* ignore startup trace errors */
}

process.on('uncaughtException', (error) => {
  try {
    appendFileSync(
      join(tmpdir(), 'tiwork-main-debug.log'),
      `${new Date().toISOString()} [startup] uncaught ${error instanceof Error ? error.stack : String(error)}\n`,
      'utf-8',
    )
  } catch {
    /* ignore startup trace errors */
  }
  throw error
})

export type BackendStatus = 'starting' | 'ready' | 'stopped' | 'error'

export interface BackendStatusInfo {
  status: BackendStatus
  port: number
  url: string
  errorMessage?: string
}

function resolveProjectRoot(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'app-dist')
  return app.getAppPath()
}

function canWriteDirectory(path: string): boolean {
  try {
    mkdirSync(path, { recursive: true })
    const probe = join(path, `.write-probe-${process.pid}`)
    writeFileSync(probe, 'ok', 'utf-8')
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

function traceMain(message: string): void {
  try {
    appendFileSync(
      join(tmpdir(), 'tiwork-main-debug.log'),
      `${new Date().toISOString()} ${message}\n`,
      'utf-8',
    )
  } catch {
    /* debug trace must never break app startup */
  }
}

function resolvePreferredLocalUserDataPath(): string {
  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA?.trim() ||
      join(app.getPath('home'), 'AppData', 'Local')
    return join(localAppData, APP_NAME)
  }
  return app.getPath('userData')
}

function ensureWritableUserDataPath(): void {
  if (process.platform === 'win32') {
    const preferred = resolvePreferredLocalUserDataPath()
    try {
      mkdirSync(preferred, { recursive: true })
      app.setPath('userData', preferred)
      traceMain(`[startup] userData=${preferred}`)
      return
    } catch (error) {
      traceMain(
        `[startup] preferred userData rejected path=${preferred} error=${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  const candidates = [
    resolvePreferredLocalUserDataPath(),
    app.getPath('userData'),
    join(tmpdir(), APP_NAME),
    join(resolveProjectRoot(), '.electron-user-data'),
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (canWriteDirectory(candidate)) {
      app.setPath('userData', candidate)
      traceMain(`[startup] userData=${candidate}`)
      return
    }
  }

  const fallback = candidates[candidates.length - 1]
  app.setPath('userData', fallback)
  traceMain(`[startup] userData fallback=${fallback}`)
}

function resolveBackendHermesHome(): string {
  if (process.platform === 'win32') {
    return join(tmpdir(), APP_NAME, 'Hermes')
  }
  return join(app.getPath('userData'), 'Hermes')
}

async function resolveBackendPort(): Promise<number> {
  const preferred = Number(process.env.TI_WORK_BACKEND_PORT ?? DEFAULT_BACKEND_PORT)
  const startPort =
    Number.isFinite(preferred) && preferred > 0 ? preferred : DEFAULT_BACKEND_PORT
  if (!(await isPortInUse(startPort))) return startPort
  return findAvailablePort(
    startPort + 1,
    async (port) => !(await isPortInUse(port)),
    MAX_BACKEND_PORT_ATTEMPTS,
  )
}

/** 本地后端进程管理：spawn / 健康检查 / 状态回调 */
class BackendManager {
  private child: ReturnType<typeof spawn> | null = null
  private status: BackendStatus = 'stopped'
  private port = DEFAULT_BACKEND_PORT
  private errorMessage = ''
  private readonly onStatusChange: (info: BackendStatusInfo) => void

  constructor(onStatusChange: (info: BackendStatusInfo) => void) {
    this.onStatusChange = onStatusChange
  }

  get info(): BackendStatusInfo {
    return {
      status: this.status,
      port: this.port,
      url: backendUrl(DEFAULT_BACKEND_HOST, this.port),
      ...(this.errorMessage === '' ? {} : { errorMessage: this.errorMessage }),
    }
  }

  private setStatus(status: BackendStatus, errorMessage = ''): void {
    this.status = status
    this.errorMessage = errorMessage
    logLine(`[backend] ${status}`)
    this.onStatusChange(this.info)
  }

  async start(): Promise<void> {
    if (this.child !== null) return
    this.port = await resolveBackendPort()
    const spec = buildSpawnSpec({
      projectRoot: resolveProjectRoot(),
      port: this.port,
      host: DEFAULT_BACKEND_HOST,
      nodeBin: process.env.TI_WORK_NODE_BIN,
      runtimeBin:
        app.isPackaged && !process.env.TI_WORK_NODE_BIN
          ? process.execPath
          : undefined,
      // 透传打包资源目录：server 是纯 Node 子进程，无法直接读 process.resourcesPath，
      // 但需要定位 resources/hermes-bootstrap/install.ps1（引擎自举安装器）。
      extraEnv: {
        TIWORK_RESOURCES_PATH: process.resourcesPath ?? '',
        HERMES_HOME: resolveBackendHermesHome(),
      },
    })
    this.setStatus('starting')
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: { ...process.env, ...spec.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.child = child
    child.stdout.on('data', (chunk) => {
      logLine(`[backend] ${String(chunk).replace(/\r?\n$/, '')}`)
    })
    child.stderr.on('data', (chunk) => {
      errorLine(`[backend] ${String(chunk).replace(/\r?\n$/, '')}`)
    })
    child.on('exit', (code) => {
      this.child = null
      if (this.status === 'stopped') return
      this.setStatus('stopped', `backend exited with code ${code ?? 'unknown'}`)
    })
    const ready = await waitForBackend(this.info.url, {
      timeoutMs: BACKEND_READY_TIMEOUT_MS,
      intervalMs: BACKEND_PROBE_INTERVAL_MS,
      probe: (url) => fetch(url).then((res) => ({ ok: res.ok })),
    })
    if (ready) {
      this.setStatus('ready')
    } else {
      this.setStatus('error', '本地服务未在限定时间内就绪，请检查端口与日志')
    }
  }

  async stop(): Promise<void> {
    const child = this.child
    this.child = null
    if (child === null) return
    this.setStatus('stopped')
    child.kill()
    if (child.exitCode !== null) return
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve())
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await this.start()
  }
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let lastUpdateCheckAt: number | null = null
let updateState: UpdateState = { status: 'idle' }

const backendManager = new BackendManager((info) => {
  if (mainWindow !== null && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:backend-status', info)
  }
})

const engineManager = new EngineManager({
  onStatusChange: (info) => {
    rebuildTrayMenu()
    if (mainWindow !== null && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('app:engine-status', info)
    }
  },
})

function engineRunning(): boolean {
  return (
    engineManager.info.status === 'ready' ||
    engineManager.info.status === 'external'
  )
}

function showMainWindow(): void {
  if (mainWindow === null) return
  mainWindow.show()
  mainWindow.focus()
}

function quitApp(): void {
  isQuitting = true
  void engineManager.stop()
  void backendManager.stop()
  app.quit()
}

function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body }).show()
}

function createMainWindow(): void {
  const win = new BrowserWindow(
    buildWindowOptions(join(__dirname, 'preload.cjs')),
  )
  mainWindow = win
  win.on('close', (event) => {
    if (!isQuitting) {
      // 关闭窗口只隐藏到托盘，退出走托盘菜单
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })
}

function getOpenAtLogin(): boolean {
  return app.getLoginItemSettings().openAtLogin
}

function setOpenAtLogin(enabled: boolean): boolean {
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
  return getOpenAtLogin()
}

function onTrayAction(action: TrayMenuAction): void {
  switch (action) {
    case 'show-window':
      showMainWindow()
      break
    case 'restart-backend':
      void backendManager.restart()
      break
    case 'restart-engine':
      void (async () => {
        await engineManager.stop()
        await engineManager.ensure()
      })()
      break
    case 'open-at-login':
      setOpenAtLogin(!getOpenAtLogin())
      rebuildTrayMenu()
      break
    case 'quit':
      quitApp()
      break
  }
}

function rebuildTrayMenu(): void {
  if (tray === null) return
  const state = {
    openAtLogin: getOpenAtLogin(),
    backendRunning: backendManager.info.status === 'ready',
    backendPort: backendManager.info.port,
    engineRunning: engineRunning(),
  }
  const template = buildTrayMenuTemplate(state).map((item) => {
    const action = item.action
    return {
      label: item.label,
      type: item.type,
      checked: item.checked,
      enabled: item.enabled,
      click: action === undefined ? undefined : () => onTrayAction(action),
    }
  })
  tray.setContextMenu(Menu.buildFromTemplate(template))
}

function setupTray(): void {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL)
  tray = new Tray(icon)
  tray.setToolTip(APP_NAME)
  tray.on('click', showMainWindow)
  rebuildTrayMenu()
  logLine('[tray] created')
}

function setupIpc(): void {
  ipcMain.handle('app:get-info', () => ({
    appName: APP_NAME,
    platform: process.platform,
    arch: process.arch,
    appVersion: app.getVersion(),
    backend: backendManager.info,
    engine: engineManager.info,
    update: updateState,
  }))
  ipcMain.handle('app:set-open-at-login', (_event, enabled: unknown) => {
    const next = setOpenAtLogin(enabled === true)
    rebuildTrayMenu()
    return next
  })
  ipcMain.handle('app:restart-backend', async () => {
    await backendManager.restart()
    return backendManager.info
  })
  ipcMain.handle('app:backend-status', () => backendManager.info)
  ipcMain.handle('app:engine-status', () => engineManager.info)
  ipcMain.handle('app:restart-engine', async () => {
    await engineManager.stop()
    await engineManager.ensure()
    return engineManager.info
  })
}

async function runUpdateCheck(): Promise<void> {
  const checkUrl = process.env.TI_WORK_UPDATE_URL
  if (checkUrl === undefined || checkUrl.trim().length === 0) return
  updateState = nextUpdateState(updateState, { type: 'check' })
  let manifest: UpdateManifest | null = null
  try {
    manifest = await fetchUpdateManifest(checkUrl, (url) =>
      fetch(url).then(async (res) => {
        if (!res.ok) return null
        return (await res.json()) as UpdateManifest
      }),
    )
  } catch {
    manifest = null
  }
  if (manifest === null) {
    updateState = nextUpdateState(updateState, { type: 'not-found' })
    return
  }
  if (isNewerVersion(app.getVersion(), manifest.version)) {
    updateState = nextUpdateState(updateState, {
      type: 'found',
      version: manifest.version,
    })
    notify(
      'Ti Work 新版本可用',
      `发现新版本 ${manifest.version}，请前往下载页面更新`,
    )
  } else {
    updateState = nextUpdateState(updateState, { type: 'not-found' })
  }
}

function setupUpdater(): void {
  // 打包环境下按固定间隔检查更新；未配置更新源时直接跳过
  if (!app.isPackaged) return
  const check = (): void => {
    if (!shouldCheckForUpdates(lastUpdateCheckAt, Date.now(), UPDATE_CHECK_INTERVAL_MS))
      return
    lastUpdateCheckAt = Date.now()
    void runUpdateCheck()
  }
  check()
  setInterval(check, UPDATE_CHECK_INTERVAL_MS)
}

async function bootstrap(): Promise<void> {
  createMainWindow()
  setupTray()
  setupIpc()
  setupUpdater()
  const win = mainWindow
  if (win !== null && !win.isDestroyed()) {
    // 首屏隐藏是为避免白屏闪烁：首帧就绪后再显示并聚焦，页面自带启动 Splash 承接后端连接过程
    win.once('ready-to-show', () => {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    })
    // 兜底：后端不可用时页面加载失败，仍把窗口显示出来（渲染层连接屏负责引导）
    win.webContents.on('did-fail-load', () => {
      if (!win.isDestroyed()) win.show()
    })
  }
  await backendManager.start()
  const info = backendManager.info
  if (info.status === 'error') {
    notify('本地服务启动失败', info.errorMessage ?? '请检查后从托盘重启')
  }
  if (win !== null && !win.isDestroyed()) {
    void win.loadURL(info.url)
  }

  // Hermes 首装由本地后端的 /api/engine-bootstrap 驱动。这里不能阻塞后端启动，
  // 否则首装时缺少内置 engine-runtime 会让用户永远进不到自举流程。
  void engineManager.ensure().then(() => {
    if (engineManager.info.status === 'error') {
      const engineError = engineManager.info.errorMessage ?? ''
      const engineMissing =
        process.platform === 'win32' && engineError.includes('未找到 Hermes 引擎')
      if (!engineMissing) {
        notify(
          'Hermes 执行引擎不可用',
          engineError || '请从托盘菜单尝试重启 Hermes 执行引擎',
        )
      }
    }
  })
}

app.disableHardwareAcceleration()
const startupKeepAlive = setInterval(() => {
  /* keep main loop alive until Electron emits ready */
}, 1_000)

app.on('ready', () => {
  clearInterval(startupKeepAlive)
  ensureWritableUserDataPath()
  const gotSingleInstanceLock = app.requestSingleInstanceLock()
  traceMain('[startup] ready')
  if (!gotSingleInstanceLock) {
    traceMain('[startup] single instance lock denied')
    if (!(process.platform === 'win32' && app.isPackaged)) {
      app.quit()
      return
    }
    traceMain('[startup] proceed without single instance lock on packaged windows')
  }
  if (gotSingleInstanceLock) {
    app.on('second-instance', () => showMainWindow())
  }
  app.setAppUserModelId(APP_ID)
  void bootstrap()
})

// 托盘常驻：所有窗口关闭不退出
app.on('window-all-closed', () => {
  // no-op：应用驻留托盘
})
app.on('before-quit', () => {
  isQuitting = true
  void engineManager.stop()
  void backendManager.stop()
})
