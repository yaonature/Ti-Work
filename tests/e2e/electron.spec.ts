/**
 * G5 e2e —— Electron 壳启动冒烟（真实 Electron 43 + 真实后端进程）。
 *
 * 覆盖（DoD：electron 启动冒烟——加载构建产物、托盘出现）：
 *  - 壳启动后 spawn 本地后端（node server-entry.js），健康检查就绪后加载页面
 *  - 主进程日志断言：托盘已创建（[tray] created）、后端就绪（[backend] ready）
 *  - preload 桥：window.tiwork 暴露且 getAppInfo 返回壳信息与后端地址
 *
 * 前置：pnpm build（dist）与 pnpm electron:compile（dist-electron），
 * electron 二进制缺失时整体跳过（不污染常规 test:e2e 门禁）。
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

const root = process.cwd()
const electronExe = join(
  root,
  'node_modules',
  'electron',
  'dist',
  process.platform === 'win32' ? 'electron.exe' : 'electron',
)
const mainCjs = join(root, 'dist-electron', 'main.cjs')
const hasArtifacts = existsSync(electronExe) && existsSync(mainCjs)

test.describe('Ti Work Electron shell', () => {
  test.describe.configure({ timeout: 180_000 })

  test.skip(
    !hasArtifacts,
    '缺少产物：先运行 pnpm build 与 pnpm electron:compile（含 electron 二进制）',
  )

  async function launchApp() {
    return electron.launch({
      // --disable-features=msTextServiceOnDesktop：禁用 Windows 桌面文本服务，
      // 避免搜狗 IME 在退出时写 %LocalAppData%\LocalLow\SogouPY 日志（沙箱拦截噪音）
      args: ['.', '--no-sandbox', '--disable-features=msTextServiceOnDesktop'],
      cwd: root,
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-require-module',
      },
    })
  }

  test('启动冒烟：加载构建产物、托盘出现、后端就绪', async () => {
    const app = await launchApp()
    let output = ''
    app.process().stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // 窗口加载的是壳启动的本地后端（仅回环地址）
    const url = new URL(page.url())
    expect(url.hostname).toBe('127.0.0.1')

    // 托盘已创建
    await expect.poll(() => output, { timeout: 60_000 }).toContain('[tray] created')
    // 后端健康检查就绪（日志顺序上托盘先于就绪）
    await expect.poll(() => output, { timeout: 60_000 }).toContain('[backend] ready')

    await app.close()
  })

  test('preload 桥：tiwork API 可用并返回壳信息', async () => {
    const app = await launchApp()
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    const bridgeType = await page.evaluate(() => {
      const bridge = (
        window as { tiwork?: { getAppInfo?: unknown; getBackendStatus?: unknown } }
      ).tiwork
      if (bridge === undefined) return 'missing'
      return typeof bridge.getAppInfo === 'function' ? 'present' : 'partial'
    })
    expect(bridgeType).toBe('present')

    const info = await page.evaluate(async () => {
      const bridge = (
        window as {
          tiwork?: { getAppInfo?: () => Promise<unknown> }
        }
      ).tiwork
      if (bridge === undefined || bridge.getAppInfo === undefined) return null
      const raw = await bridge.getAppInfo()
      const value = raw as {
        appName?: string
        backend?: { status?: string; url?: string }
      }
      return {
        appName: value.appName ?? '',
        backendStatus: value.backend?.status ?? '',
        backendUrl: value.backend?.url ?? '',
      }
    })
    expect(info?.appName).toBe('Ti Work')
    expect(info?.backendStatus).toMatch(/^(starting|ready)$/)
    expect(info?.backendUrl.startsWith('http://127.0.0.1')).toBe(true)

    await app.close()
  })
})
