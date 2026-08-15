import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// 浏览器安装到项目本地（沙箱/CI 环境无法写 %LOCALAPPDATA%\ms-playwright）
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.playwright-browsers',
)

/**
 * e2e 专用的 HERMES_HOME —— 指向项目内 .e2e-hermes 临时目录，
 * 防止集成测试写入开发者真实的 ~/.hermes/config.yaml。
 */
export const E2E_HERMES_HOME = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '.e2e-hermes',
)

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // 禁用 Windows 桌面文本服务（TSF）：阻止搜狗输入法等 IME 注入
        // 并写 %LocalAppData%\LocalLow\SogouPY 日志（沙箱内被拦截）
        launchOptions: {
          args: ['--disable-features=msTextServiceOnDesktop'],
        },
      },
    },
  ],
  webServer: {
    command: 'node server-entry.js',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      HERMES_HOME: E2E_HERMES_HOME,
    },
  },
})
