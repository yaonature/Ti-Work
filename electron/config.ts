/**
 * Electron 壳配置 —— 纯函数集中定义窗口/托盘/后端/更新参数。
 *
 * 不依赖 electron 运行时（node 环境可独立单测），main.ts 只负责装配。
 * 与"后端定义一切"一致：壳侧可配置项全部收敛于此，不散落魔法值。
 */

export const APP_ID = 'com.tiwork.app'
export const APP_NAME = 'Ti Work'

/** 本地后端默认监听地址（壳内仅访问回环地址，不直连 Redis） */
export const DEFAULT_BACKEND_HOST = '127.0.0.1'
export const DEFAULT_BACKEND_PORT = 3000

/** 后端健康检查超时与轮询间隔 */
export const BACKEND_READY_TIMEOUT_MS = 30_000
export const BACKEND_PROBE_INTERVAL_MS = 500

/** 自动更新检查间隔（6 小时） */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/** 端口冲突时向后扫描的最大尝试次数 */
export const MAX_BACKEND_PORT_ATTEMPTS = 20

export interface WindowOptions {
  width: number
  height: number
  minWidth: number
  minHeight: number
  show: boolean
  autoHideMenuBar: boolean
  backgroundColor: string
  title: string
  webPreferences: {
    preload: string
    contextIsolation: boolean
    nodeIntegration: boolean
    sandbox: boolean
  }
}

export function buildWindowOptions(preloadPath: string): WindowOptions {
  return {
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    // 首屏隐藏：后端就绪后再展示，避免白屏闪烁
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0f0f16',
    title: APP_NAME,
    webPreferences: {
      preload: preloadPath,
      // 渲染进程最小权限：隔离上下文 + 沙箱 + 无 Node 集成
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  }
}

export type TrayMenuAction =
  | 'show-window'
  | 'restart-backend'
  | 'open-at-login'
  | 'quit'
  | 'restart-engine'

export interface TrayMenuItem {
  id: string
  label: string
  enabled: boolean
  checked?: boolean
  type?: 'normal' | 'checkbox' | 'separator'
  action?: TrayMenuAction
}

export interface TrayMenuState {
  openAtLogin: boolean
  backendRunning: boolean
  backendPort: number
  engineRunning: boolean
}

export function buildTrayMenuTemplate(state: TrayMenuState): Array<TrayMenuItem> {
  return [
    { id: 'show-window', label: '显示 Ti Work', enabled: true, action: 'show-window' },
    { id: 'sep-1', label: '', enabled: false, type: 'separator' },
    {
      id: 'restart-backend',
      label: '重启本地服务',
      enabled: state.backendRunning,
      action: 'restart-backend',
    },
    {
      id: 'restart-engine',
      label: '重启 Hermes 执行引擎',
      enabled: state.engineRunning,
      action: 'restart-engine',
    },
    {
      id: 'open-at-login',
      label: '开机自启',
      enabled: true,
      type: 'checkbox',
      checked: state.openAtLogin,
      action: 'open-at-login',
    },
    { id: 'sep-2', label: '', enabled: false, type: 'separator' },
    { id: 'quit', label: '退出 Ti Work', enabled: true, action: 'quit' },
  ]
}

export function backendUrl(host: string, port: number): string {
  return `http://${host}:${port}`
}
