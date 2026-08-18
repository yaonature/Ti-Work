#!/usr/bin/env node
/**
 * 生成 Hermes 引擎安装器暂存目录 .bootstrap-stage（打包 extraResources 数据源）。
 *
 * 目标：把官方 Windows 安装器 install.ps1 内置进安装包，让 Ti Work 首次启动
 * 可以离线自动安装 Hermes 执行引擎（hermes gateway），用户无需任何手动步骤。
 *
 * 来源优先级（自上而下，找到即用）：
 *  1. 环境变量 HERMES_INSTALLER_SOURCE（显式指定 install.ps1 路径）
 *  2. 项目内 .research/hermes-agent/scripts/install.ps1（源码研究/开发时）
 *  3. 官方 GitHub raw（锁定 main 分支，带 Last-Modified 版本标记）
 *
 * 额外：若存在 .research/hermes-agent 源码快照，则一并拷入
 * .bootstrap-stage/hermes-agent-source，供首启 bootstrap 直接落地到用户级
 * HERMES_HOME，跳过 repository 阶段的 git clone / ZIP 下载。
 *
 * 目录不存在时静默跳过：产物仍可打包，应用首次启动时改为在线下载官方脚本。
 * 用法：node scripts/stage-hermes-bootstrap.mjs
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, '.bootstrap-stage')
const SOURCE_SNAPSHOT_DIR = join(ROOT, '.research', 'hermes-agent')
const VERSION_URL =
  'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1'

function findLocalInstaller() {
  const fromEnv = process.env.HERMES_INSTALLER_SOURCE?.trim()
  if (fromEnv && existsSync(fromEnv)) return { path: fromEnv, source: 'env' }
  const local = join(ROOT, '.research', 'hermes-agent', 'scripts', 'install.ps1')
  if (existsSync(local)) return { path: local, source: '.research/hermes-agent' }
  return null
}

async function downloadInstaller() {
  const response = await fetch(VERSION_URL, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  const lastModified = response.headers.get('last-modified') || ''
  const text = await response.text()
  if (!text.includes('InstallStageProtocolVersion')) {
    throw new Error('下载内容不是有效的 install.ps1')
  }
  return { text, lastModified }
}

async function main() {
  const local = findLocalInstaller()
  let installerPath = null
  let versionNote = ''

  if (local) {
    installerPath = local.path
    versionNote = `source=${local.source}`
    console.log(`[stage-bootstrap] 使用本地官方安装器：${installerPath}`)
  } else {
    try {
      const remote = await downloadInstaller()
      const tmpPath = join(ROOT, '.research', 'hermes-agent-bootstrap-cache')
      mkdirSync(tmpPath, { recursive: true })
      installerPath = join(tmpPath, 'install.ps1')
      writeFileSync(installerPath, remote.text, 'utf-8')
      versionNote = `source=github(main) last-modified=${remote.lastModified}`
      console.log(
        `[stage-bootstrap] 已从 GitHub 下载官方安装器（${remote.lastModified}）`,
      )
    } catch (error) {
      console.log(
        `[stage-bootstrap] 未找到本地安装器且在线下载失败（${error instanceof Error ? error.message : error}），跳过内置安装器；应用将改为在线下载。`,
      )
      process.exit(0)
    }
  }

  rmSync(TARGET, { recursive: true, force: true })
  mkdirSync(TARGET, { recursive: true })
  cpSync(installerPath, join(TARGET, 'install.ps1'))
  // 安装期预装脚本（NSIS customInstall 调用）：资源落地 + 阶段安装 + 状态写入。
  // 与 install.ps1 同目录打进安装包 resources/hermes-bootstrap。
  // 注意：脚本含中文，Windows PowerShell 5.1 无 BOM 会按 ANSI 代码页解析出错，
  // 因此这里强制以 UTF-8 BOM 形式落盘。
  const preinstall = join(__dirname, 'hermes-installer-preinstall.ps1')
  if (existsSync(preinstall)) {
    // 循环剥离头部重复 BOM（源文件若被编辑器多次追加 BOM，Windows PowerShell
    // 5.1 加载双 BOM 脚本会解析失败且不执行任何语句），再强制落盘单 BOM。
    let raw = readFileSync(preinstall)
    while (
      raw.length >= 3 &&
      raw[0] === 0xef &&
      raw[1] === 0xbb &&
      raw[2] === 0xbf
    ) {
      raw = raw.subarray(3)
    }
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), raw])
    writeFileSync(join(TARGET, 'install-hermes.ps1'), withBom)
    console.log('[stage-bootstrap] 安装期预装脚本已暂存 → install-hermes.ps1')
  } else {
    console.warn('[stage-bootstrap] 未找到 install-hermes.ps1，安装器将退回首启自举')
  }
  writeFileSync(
    join(TARGET, 'version.json'),
    JSON.stringify(
      {
        name: 'hermes-agent-installer',
        protocol: 'stage-protocol-v1',
        versionNote,
        stagedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf-8',
  )
  if (existsSync(SOURCE_SNAPSHOT_DIR)) {
    const targetSourceDir = join(TARGET, 'hermes-agent-source')
    cpSync(SOURCE_SNAPSHOT_DIR, targetSourceDir, {
      recursive: true,
      force: true,
    })
    console.log(`[stage-bootstrap] 源码快照已暂存 → ${targetSourceDir}`)
  } else {
    console.log('[stage-bootstrap] 未找到 .research/hermes-agent，跳过内置源码快照')
  }
  console.log(`[stage-bootstrap] 安装器已暂存 → ${join(TARGET, 'install.ps1')}`)
}

main().catch((error) => {
  console.error('[stage-bootstrap] 失败：', error)
  process.exit(1)
})
