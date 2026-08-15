/**
 * Electron 预加载脚本 —— 经 contextBridge 向渲染进程暴露壳桥（最小权限）。
 *
 * 渲染进程仅可：查询壳信息、切换开机自启、重启本地服务、订阅后端状态；
 * 不暴露 ipcRenderer 全量能力，保持 contextIsolation + sandbox。
 */
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'

export interface BackendStatusInfo {
  status: 'starting' | 'ready' | 'stopped' | 'error'
  port: number
  url: string
  errorMessage?: string
}

export interface EngineStatusInfo {
  status: 'idle' | 'external' | 'starting' | 'ready' | 'error'
  url: string
  errorMessage?: string
}

export interface AppInfo {
  appName: string
  platform: string
  arch: string
  appVersion: string
  backend: BackendStatusInfo
  engine: EngineStatusInfo
  update: {
    status: string
    latestVersion?: string
    currentVersion?: string
    errorMessage?: string
  }
}

const bridge = {
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:get-info'),
  setOpenAtLogin: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke('app:set-open-at-login', enabled),
  restartBackend: (): Promise<BackendStatusInfo> =>
    ipcRenderer.invoke('app:restart-backend'),
  getBackendStatus: (): Promise<BackendStatusInfo> =>
    ipcRenderer.invoke('app:backend-status'),
  onBackendStatus: (
    callback: (info: BackendStatusInfo) => void,
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, info: BackendStatusInfo): void => {
      callback(info)
    }
    ipcRenderer.on('app:backend-status', listener)
    return () => {
      ipcRenderer.removeListener('app:backend-status', listener)
    }
  },
  getEngineStatus: (): Promise<EngineStatusInfo> =>
    ipcRenderer.invoke('app:engine-status'),
  restartEngine: (): Promise<EngineStatusInfo> =>
    ipcRenderer.invoke('app:restart-engine'),
  onEngineStatus: (
    callback: (info: EngineStatusInfo) => void,
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, info: EngineStatusInfo): void => {
      callback(info)
    }
    ipcRenderer.on('app:engine-status', listener)
    return () => {
      ipcRenderer.removeListener('app:engine-status', listener)
    }
  },
}

contextBridge.exposeInMainWorld('tiwork', bridge)

export type TiWorkBridge = typeof bridge
