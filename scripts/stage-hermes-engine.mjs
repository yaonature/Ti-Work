#!/usr/bin/env node
/**
 * 生成 Hermes 引擎运行时暂存目录 .engine-stage（打包 extraResources 数据源）。
 *
 * 来源优先级（自上而下，找到即用）：
 *  1. 环境变量 HERMES_ENGINE_SOURCE（显式指定运行时目录）
 *  2. 项目内 engine-runtime-source/（开发时把引擎运行时放这里）
 *  3. 用户目录 ~/.hermes/runtime/（hermes setup 安装的运行时）
 *
 * 引擎运行时目录预期结构（electron/hermes-engine.ts 的 resolveEngineLauncher
 * 与之一致）：
 *   <source>/bin/hermes(.exe|sh)        ← 启动器
 *   <source>/...                         ← Python 解释器/依赖等
 *
 * 目录不存在时静默跳过：产物仍可打包，主进程降级为"依赖外部网关"。
 * 用法：node scripts/stage-hermes-engine.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TARGET = join(ROOT, '.engine-stage')

function candidates() {
  const list = []
  const fromEnv = process.env.HERMES_ENGINE_SOURCE?.trim()
  if (fromEnv) list.push(fromEnv)
  list.push(join(ROOT, 'engine-runtime-source'))
  list.push(join(os.homedir(), '.hermes', 'runtime'))
  return list
}

function findSource() {
  for (const dir of candidates()) {
    if (!existsSync(dir)) continue
    // 有效运行时必须含 bin/hermes 启动器
    for (const name of ['hermes.exe', 'hermes', 'hermes.sh']) {
      if (existsSync(join(dir, 'bin', name))) return dir
    }
  }
  return null
}

const source = findSource()
if (source === null) {
  console.log(
    '[stage-engine] 未找到 Hermes 引擎运行时（HERMES_ENGINE_SOURCE / engine-runtime-source / ~/.hermes/runtime），跳过内置引擎。',
  )
  process.exit(0)
}

rmSync(TARGET, { recursive: true, force: true })
mkdirSync(TARGET, { recursive: true })
cpSync(source, TARGET, { recursive: true })
console.log(`[stage-engine] 引擎运行时已暂存：${source} → ${TARGET}`)
