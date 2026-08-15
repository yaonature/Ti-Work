#!/usr/bin/env node
/**
 * 同步桌面版安装包到官网静态目录，供「下载桌面版」区块直接提供下载。
 *
 * 流程：从 release/ 查找最新 Windows NSIS 安装包（Ti Work Setup *.exe），
 * 复制到 Ti-Work-WebSite/public/downloads/，并生成 SHA-256 校验文件。
 * 官网构建后 /downloads/ 即随站点发布（App.tsx 中 DOWNLOADS.file 指向该路径）。
 *
 * 运行：node scripts/sync-website-downloads.mjs
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RELEASE_DIR = join(ROOT, 'release')
const SITE_PUBLIC = join(ROOT, 'Ti-Work-WebSite', 'public')
const DOWNLOAD_DIR = join(SITE_PUBLIC, 'downloads')

/** 在 release/ 中查找最新 Windows 安装包 */
function findLatestWindowsSetup() {
  if (!existsSync(RELEASE_DIR)) return null
  const candidates = readdirSync(RELEASE_DIR)
    .filter((f) => /^Ti Work Setup .+\.exe$/.test(f))
    .map((f) => ({ name: f, path: join(RELEASE_DIR, f), mtime: statSync(join(RELEASE_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return candidates[0] ?? null
}

const setup = findLatestWindowsSetup()
if (!setup) {
  console.error(`[sync-website-downloads] 未在 ${RELEASE_DIR} 找到 "Ti Work Setup *.exe"，请先运行 pnpm electron:build`)
  process.exit(1)
}

mkdirSync(DOWNLOAD_DIR, { recursive: true })
const target = join(DOWNLOAD_DIR, setup.name)
copyFileSync(setup.path, target)

// SHA-256 校验文件（下载区展示与安全核验）
const digest = createHash('sha256').update(readFileSync(target)).digest('hex')
writeFileSync(`${target}.sha256`, `${digest}  ${setup.name}\n`, 'utf-8')

console.log(`[sync-website-downloads] 已同步 ${setup.name} → Ti-Work-WebSite/public/downloads/`)
console.log(`[sync-website-downloads] sha256: ${digest}`)
console.log(`[sync-website-downloads] 官网构建后即可通过 /downloads/${encodeURIComponent(setup.name)} 提供下载`)
