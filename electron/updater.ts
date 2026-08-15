/**
 * Electron 壳 —— 自动更新状态机（纯函数，node 环境可单测）。
 *
 * 版本解析/新旧判定/检查时机/状态流转全部收敛于此，
 * electron-updater 的实际驱动在 main.ts 中装配，保证逻辑可验证。
 */

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'error'
  | 'downloading'
  | 'installing'

export interface UpdateState {
  status: UpdateStatus
  latestVersion?: string
  currentVersion?: string
  errorMessage?: string
}

export interface ParsedVersion {
  major: number
  minor: number
  patch: number
}

export function parseVersion(v: string): ParsedVersion | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(v.trim())
  if (m === null) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  }
}

export function isNewerVersion(current: string, candidate: string): boolean {
  const a = parseVersion(current)
  const b = parseVersion(candidate)
  if (a === null || b === null) return false
  if (b.major !== a.major) return b.major > a.major
  if (b.minor !== a.minor) return b.minor > a.minor
  return b.patch > a.patch
}

export type UpdateEvent =
  | { type: 'check' }
  | { type: 'found'; version: string }
  | { type: 'not-found' }
  | { type: 'error'; message: string }
  | { type: 'download-started' }
  | { type: 'download-finished' }
  | { type: 'dismiss' }

export function nextUpdateState(
  prev: UpdateState,
  event: UpdateEvent,
): UpdateState {
  const base = { currentVersion: prev.currentVersion }
  switch (event.type) {
    case 'check':
      return { status: 'checking', ...base }
    case 'found':
      return { status: 'available', latestVersion: event.version, ...base }
    case 'not-found':
      return { status: 'not-available', ...base }
    case 'error':
      return { status: 'error', errorMessage: event.message, ...base }
    case 'download-started':
      return { status: 'downloading', latestVersion: prev.latestVersion, ...base }
    case 'download-finished':
      return { status: 'installing', latestVersion: prev.latestVersion, ...base }
    case 'dismiss':
      return { status: 'idle' }
  }
}

export function shouldCheckForUpdates(
  lastCheckAt: number | null,
  now: number,
  intervalMs: number,
): boolean {
  if (lastCheckAt === null) return true
  return now - lastCheckAt >= intervalMs
}
