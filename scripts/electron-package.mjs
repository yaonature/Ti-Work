#!/usr/bin/env node
/**
 * electron-builder 封装：注入下载镜像（electron-builder 打包工具链从 GitHub 拉取，
 * 国内网络走 npmmirror 镜像），透传命令行参数。
 * 用法：node scripts/electron-package.mjs [--dir] [target...]
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const builderBin = join(
  ROOT,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
)

/**
 * electron-builder 缓存（.electron-builder-cache）位于项目根时，解压出的
 * 图标工具链（icons-bundle 内的 icon-tool.js / vips-node.js 等）是 CJS 脚本，
 * 而项目根 package.json 声明 type: module —— node 会按 ESM 解析导致
 * `require is not defined` 崩溃。这里给每个 icons-bundle 目录补一个
 * `{"type":"commonjs"}` 的 package.json，让 node 就近按 CJS 解析。
 */
function ensureIconsBundleCommonJs() {
  const cacheDir = join(
    ROOT,
    '.electron-builder-cache',
  )
  if (!existsSync(cacheDir)) return
  const groups = readdirSync(cacheDir).filter((n) => n.startsWith('icons@'))
  for (const group of groups) {
    const groupDir = join(cacheDir, group)
    let bundles = []
    try {
      bundles = readdirSync(groupDir)
    } catch {
      continue
    }
    for (const bundle of bundles) {
      if (!bundle.startsWith('icons-bundle-')) continue
      const bundleDir = join(groupDir, bundle)
      if (!existsSync(bundleDir) || !statSync(bundleDir).isDirectory()) continue
      const pkgPath = join(bundleDir, 'package.json')
      if (existsSync(pkgPath)) {
        try {
          if (JSON.parse(readFileSync(pkgPath, 'utf-8')).type === 'commonjs') continue
        } catch {
          // 破损则覆盖
        }
      }
      writeFileSync(pkgPath, JSON.stringify({ type: 'commonjs' }, null, 2), 'utf-8')
    }
  }
}

ensureIconsBundleCommonJs()

const res = spawnSync(builderBin, process.argv.slice(2), {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    // Node 22.11 下 electron-builder 依赖链 require() ES Module（@noble/hashes），
    // 与 electron install.js 相同的处理方式：开启实验性 require(esm) 支持。
    NODE_OPTIONS: [
      process.env.NODE_OPTIONS,
      '--experimental-require-module',
    ]
      .filter(Boolean)
      .join(' '),
    ELECTRON_MIRROR:
      process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR ??
      'https://npmmirror.com/mirrors/electron-builder-binaries/',
    // 缓存重定向到项目内（沙箱/CI 禁止写 %LOCALAPPDATA%\electron\Cache）
    ELECTRON_CACHE:
      process.env.ELECTRON_CACHE ?? join(ROOT, '.electron-cache'),
    ELECTRON_BUILDER_CACHE:
      process.env.ELECTRON_BUILDER_CACHE ?? join(ROOT, '.electron-builder-cache'),
    electron_config_cache:
      process.env.electron_config_cache ?? join(ROOT, '.electron-cache'),
  },
})
process.exit(res.status ?? 1)
