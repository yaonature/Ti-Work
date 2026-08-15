#!/usr/bin/env node
/**
 * 编译 Electron 主进程/预加载为 CJS 单文件（dist-electron/）。
 * electron 模块保持 external，运行时由 Electron 提供。
 * 运行：node scripts/build-electron.mjs
 */
import { build } from 'esbuild'
import { rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'dist-electron')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const shared = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
}

await build({
  ...shared,
  entryPoints: [join(ROOT, 'electron', 'main.ts')],
  outfile: join(OUT, 'main.cjs'),
})

await build({
  ...shared,
  entryPoints: [join(ROOT, 'electron', 'preload.ts')],
  outfile: join(OUT, 'preload.cjs'),
})

console.log('wrote dist-electron/main.cjs and dist-electron/preload.cjs')
