#!/usr/bin/env node
/**
 * electron-builder 封装：注入下载镜像（electron-builder 打包工具链从 GitHub 拉取，
 * 国内网络走 npmmirror 镜像），透传命令行参数。
 * 用法：node scripts/electron-package.mjs [--dir] [target...]
 */
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
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
const RELEASE_DIR = join(ROOT, 'release')
const WIN_UNPACKED_DIR = join(RELEASE_DIR, 'win-unpacked')
const TEMP_OUTPUT_DIR = join(ROOT, '.electron-builder-output')

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

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function stopProcessesUsingWinUnpacked() {
  if (process.platform !== 'win32') return
  if (!existsSync(WIN_UNPACKED_DIR)) return

  const script = `
$target = [System.IO.Path]::GetFullPath('${WIN_UNPACKED_DIR.replace(/\\/g, '\\\\')}')
$targetLower = $target.ToLowerInvariant()
Get-CimInstance Win32_Process | ForEach-Object {
  $path = $_.ExecutablePath
  if (-not $path) { return }
  try {
    $full = [System.IO.Path]::GetFullPath($path)
    if ($full.ToLowerInvariant().StartsWith($targetLower)) {
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  } catch {
  }
}
`.trim()

  spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

function removeWithRetries(path, attempts = 6) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true, maxRetries: 0 })
      return
    } catch (error) {
      if (!existsSync(path)) return
      if (attempt === attempts) throw error
      const waitMs = 500 * attempt
      console.warn(
        `[electron-package] 清理输出目录失败（第 ${attempt}/${attempts} 次），${waitMs}ms 后重试：${error instanceof Error ? error.message : String(error)}`,
      )
      sleep(waitMs)
    }
  }
}

function prepareWindowsOutputDir(argv) {
  if (process.platform !== 'win32') return
  if (argv.includes('--prepackaged')) return
  if (!existsSync(WIN_UNPACKED_DIR)) return

  console.log(`[electron-package] 检测到旧输出目录，准备清理：${WIN_UNPACKED_DIR}`)
  stopProcessesUsingWinUnpacked()
  sleep(1200)
  removeWithRetries(WIN_UNPACKED_DIR)
}

function shouldSyncArtifact(name) {
  return (
    name.endsWith('.exe') ||
    name.endsWith('.blockmap') ||
    name.endsWith('.yaml') ||
    name.endsWith('.yml')
  )
}

function syncTempOutputToRelease() {
  if (!existsSync(TEMP_OUTPUT_DIR)) return
  mkdirSync(RELEASE_DIR, { recursive: true })

  for (const name of readdirSync(TEMP_OUTPUT_DIR)) {
    const source = join(TEMP_OUTPUT_DIR, name)
    if (!statSync(source).isFile()) continue
    if (!shouldSyncArtifact(name)) continue
    copyFileSync(source, join(RELEASE_DIR, name))
  }

  const tempWinUnpackedDir = join(TEMP_OUTPUT_DIR, 'win-unpacked')
  if (!existsSync(tempWinUnpackedDir)) {
    rmSync(TEMP_OUTPUT_DIR, { recursive: true, force: true, maxRetries: 0 })
    return
  }

  try {
    stopProcessesUsingWinUnpacked()
    sleep(1200)
    removeWithRetries(WIN_UNPACKED_DIR, 3)
    renameSync(tempWinUnpackedDir, WIN_UNPACKED_DIR)
    rmSync(TEMP_OUTPUT_DIR, { recursive: true, force: true, maxRetries: 0 })
  } catch (error) {
    console.warn(
      `[electron-package] 旧的 win-unpacked 仍被占用，新的解包产物保留在 ${tempWinUnpackedDir}：${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function buildArgsWithFallbackOutput(argv) {
  if (process.platform !== 'win32') return { builderArgs: argv, usingTempOutput: false }
  if (argv.includes('--prepackaged')) return { builderArgs: argv, usingTempOutput: false }

  try {
    prepareWindowsOutputDir(argv)
    return { builderArgs: argv, usingTempOutput: false }
  } catch (error) {
    console.warn(
      `[electron-package] 默认输出目录仍被占用，改用临时输出目录继续打包：${error instanceof Error ? error.message : String(error)}`,
    )
    rmSync(TEMP_OUTPUT_DIR, { recursive: true, force: true, maxRetries: 0 })
    return {
      builderArgs: [...argv, `-c.directories.output=${TEMP_OUTPUT_DIR}`],
      usingTempOutput: true,
    }
  }
}

ensureIconsBundleCommonJs()
const argv = process.argv.slice(2)
const { builderArgs, usingTempOutput } = buildArgsWithFallbackOutput(argv)

const res = spawnSync(builderBin, builderArgs, {
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

if (res.status === 0 && usingTempOutput) {
  syncTempOutputToRelease()
}

process.exit(res.status ?? 1)
