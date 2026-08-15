#!/usr/bin/env node
/**
 * 确保 Electron 二进制存在（postinstall 被 pnpm 白名单拦截时的兜底）。
 * 已存在则直接退出；缺失则触发 electron 官方 install.js 下载：
 *  - NODE_OPTIONS 开启 require(esm)（本机 Node 22.11 跑 electron 43 install.js 所需）
 *  - ELECTRON_MIRROR 走国内镜像，缓存落在项目 .electron-cache（沙箱规避用户目录权限）
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const binaryName = process.platform === 'win32' ? 'electron.exe' : 'electron'
const binary = join(ROOT, 'node_modules', 'electron', 'dist', binaryName)
if (existsSync(binary)) {
  console.log('[electron] binary present')
  process.exit(0)
}

const installJs = join(ROOT, 'node_modules', 'electron', 'install.js')
const cacheDir = join(ROOT, '.electron-cache')
console.log('[electron] downloading binary via install.js')
const res = spawnSync(process.execPath, [installJs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--experimental-require-module',
    ELECTRON_MIRROR:
      process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
    electron_config_cache: cacheDir,
  },
})
process.exit(res.status ?? 1)
