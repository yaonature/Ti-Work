/**
 * G5 contract tests — Electron shell pure logic: window / tray / backend / update.
 *
 * Coverage (DoD: prerequisite for the electron startup smoke test — shell config logic is first
 * converged into pure functions):
 *  - buildWindowOptions: window size / min size / hidden on first screen / secure WebPreferences
 *    (contextIsolation + sandbox + nodeIntegration disabled), preload path passed through
 *  - buildTrayMenuTemplate: tray menu structure (show / restart service / open at login / quit),
 *    producing enabled/checked from runtime state (whether the backend is running, whether autostart is on)
 *  - backendUrl: backend ready URL assembly
 *
 * No electron runtime needed; runs directly in the node environment.
 */
import { describe, expect, it } from 'vitest'
import {
  APP_ID,
  APP_NAME,
  DEFAULT_BACKEND_HOST,
  DEFAULT_BACKEND_PORT,
  backendUrl,
  buildTrayMenuTemplate,
  buildWindowOptions,
} from '../../electron/config'

describe('buildWindowOptions', () => {
  it('builds secure main window options', () => {
    const opts = buildWindowOptions('/abs/path/preload.cjs')
    expect(opts.title).toBe(APP_NAME)
    expect(opts.width).toBe(1280)
    expect(opts.height).toBe(800)
    expect(opts.minWidth).toBe(960)
    expect(opts.minHeight).toBe(600)
    expect(opts.show).toBe(false)
    expect(opts.autoHideMenuBar).toBe(true)
    expect(opts.backgroundColor.length).toBeGreaterThan(0)
  })

  it('stays hidden until the backend is ready to avoid white-screen flicker', () => {
    const opts = buildWindowOptions('/abs/path/preload.cjs')
    expect(opts.show).toBe(false)
  })

  it('webPreferences use least privilege: isolation + sandbox + no Node integration', () => {
    const opts = buildWindowOptions('/abs/path/preload.cjs')
    expect(opts.webPreferences.preload).toBe('/abs/path/preload.cjs')
    expect(opts.webPreferences.contextIsolation).toBe(true)
    expect(opts.webPreferences.nodeIntegration).toBe(false)
    expect(opts.webPreferences.sandbox).toBe(true)
  })
})

describe('buildTrayMenuTemplate', () => {
  it('generates the tray menu with the fixed structure (show / sep / restart service / restart engine / autostart / sep / quit)', () => {
    const items = buildTrayMenuTemplate({
      openAtLogin: false,
      backendRunning: true,
      backendPort: DEFAULT_BACKEND_PORT,
      engineRunning: true,
    })
    expect(items.map((i) => i.id)).toEqual([
      'show-window',
      'sep-1',
      'restart-backend',
      'restart-engine',
      'open-at-login',
      'sep-2',
      'quit',
    ])
    expect(items[0]?.action).toBe('show-window')
    expect(items[2]?.action).toBe('restart-backend')
    expect(items[3]?.action).toBe('restart-engine')
    expect(items[6]?.action).toBe('quit')
  })

  it('disables "restart local service" when the backend is not running', () => {
    const items = buildTrayMenuTemplate({
      openAtLogin: false,
      backendRunning: false,
      backendPort: DEFAULT_BACKEND_PORT,
      engineRunning: true,
    })
    const restart = items.find((i) => i.id === 'restart-backend')
    expect(restart?.enabled).toBe(false)
  })

  it('disables "restart engine" when the engine is not running', () => {
    const items = buildTrayMenuTemplate({
      openAtLogin: false,
      backendRunning: true,
      backendPort: DEFAULT_BACKEND_PORT,
      engineRunning: false,
    })
    const restart = items.find((i) => i.id === 'restart-engine')
    expect(restart?.enabled).toBe(false)
  })

  it('open-at-login is a checkbox with checked reflecting state', () => {
    const off = buildTrayMenuTemplate({
      openAtLogin: false,
      backendRunning: true,
      backendPort: DEFAULT_BACKEND_PORT,
      engineRunning: true,
    })
    const item = off.find((i) => i.id === 'open-at-login')
    expect(item?.type).toBe('checkbox')
    expect(item?.checked).toBe(false)

    const on = buildTrayMenuTemplate({
      openAtLogin: true,
      backendRunning: true,
      backendPort: DEFAULT_BACKEND_PORT,
      engineRunning: true,
    })
    expect(on.find((i) => i.id === 'open-at-login')?.checked).toBe(true)
  })
})

describe('backendUrl', () => {
  it('assembles the backend ready URL', () => {
    expect(backendUrl(DEFAULT_BACKEND_HOST, DEFAULT_BACKEND_PORT)).toBe(
      'http://127.0.0.1:3000',
    )
    expect(backendUrl('127.0.0.1', 3100)).toBe('http://127.0.0.1:3100')
  })
})

describe('shell constants', () => {
  it('app id and name', () => {
    expect(APP_ID).toMatch(/^[a-z0-9.]+$/)
    expect(APP_NAME.length).toBeGreaterThan(0)
  })
})
