#!/usr/bin/env node
/**
 * Stage 桌面应用后端运行依赖：
 * 1. 解析 dist/server/server.js 与 server-entry.js 的顶层外部 import（包名），
 *    BFS 收集其 dependencies/peerDependencies 完整闭包；
 * 2. 从 pnpm symlink 的 node_modules 平铺拷贝（dereference）到 .electron-stage/node_modules；
 * 3. 生成 .electron-stage/package.json（type: module），保证 server-entry.js 以 ESM 解析。
 *
 * 产出目录 .electron-stage/ 由 electron-builder extraResources 携带为 resources/app-dist。
 * 这样打包产物无需携带完整 node_modules（files 已排除），后端仍可独立启动。
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const STAGE = join(ROOT, '.electron-stage')
const STAGE_MODULES = join(STAGE, 'node_modules')
const PKG_ROOT = join(ROOT, 'node_modules')

/** 提取 ESM/CJS 顶层包名 import（排除相对路径与 node 内置）。
 *  除静态 import 外，还覆盖 `createRequire` 动态 require（_require$1("pkg")），
 *  这类调用会被 Vite 保留在懒加载 chunk 中（如 better-sqlite3）。 */
function collectPackageImports(filePath) {
  // 先剥离块注释，避免 JSDoc（如 `* from "extension"`）被误判为包名
  const source = readFileSync(filePath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
  const names = new Set()
  const re =
    /(?:from\s+|import\s*\(\s*|(?:createRequire|require|_require)\w*\$?\w*\s*\(\s*)['"]([^'"]+)['"]/g
  let match
  while ((match = re.exec(source)) !== null) {
    const spec = match[1]
    // 跳过模板字面量插值（如 "${opts.from}"）
    if (spec.includes('${') || spec.includes('}')) continue
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      const bare = spec.split('/')[0]
      if (builtinModules.includes(bare) || spec.startsWith('node:')) continue
      names.add(spec.split('/').slice(0, spec.startsWith('@') ? 2 : 1).join('/'))
    }
  }
  return names
}

/** 递归收集 dist/server 下全部 JS chunk（SSR 产物可能把依赖拆进懒加载 chunk） */
function collectServerChunkFiles() {
  const files = []
  const serverDir = join(ROOT, 'dist', 'server')
  if (!existsSync(serverDir)) return files
  for (const rel of readdirSync(serverDir, { recursive: true })) {
    if (typeof rel === 'string' && rel.endsWith('.js')) {
      files.push(join(serverDir, rel))
    }
  }
  return files
}

/** 解析包真实目录：pnpm 隔离结构下优先从来源包的同级 node_modules 解析，其次顶层 */
function resolvePackageDir(name, fromRealDir) {
  if (fromRealDir) {
    // pnpm 隔离目录内链接名是裸名（@tanstack/router-core → router-core）
    const bare = name.startsWith('@') ? name.split('/').slice(1).join('/') : name
    const sibling = join(dirname(fromRealDir), bare)
    if (existsSync(sibling)) {
      try {
        return realpathSync(sibling)
      } catch {
        // ignore broken link
      }
    }
  }
  const top = join(PKG_ROOT, name)
  if (existsSync(top)) {
    try {
      return realpathSync(top)
    } catch {
      // ignore broken link
    }
  }
  // 三级兜底：扫描 pnpm store（.pnpm/<pkgid>/node_modules/<name>）
  const pnpmDir = join(PKG_ROOT, '.pnpm')
  let pnpmEntries = []
  try {
    pnpmEntries = readdirSync(pnpmDir)
  } catch {
    return null
  }
  for (const entry of pnpmEntries) {
    const candidate = join(pnpmDir, entry, 'node_modules', name)
    if (existsSync(candidate)) {
      try {
        return realpathSync(candidate)
      } catch {
        // ignore broken link
      }
    }
  }
  return null
}

function readPkgJson(pkgName, fromRealDir) {
  const real = resolvePackageDir(pkgName, fromRealDir)
  if (!real) return null
  const pkgPath = join(real, 'package.json')
  if (!existsSync(pkgPath)) return null
  try {
    return { dir: real, data: JSON.parse(readFileSync(pkgPath, 'utf-8')) }
  } catch {
    return null
  }
}

function collectDependencyClosure(entrySpecs) {
  const collected = new Map() // name -> real directory（平铺收集，含 pnpm 隔离兄弟）
  const queue = entrySpecs.map((name) => ({ name, from: undefined }))
  while (queue.length > 0) {
    const { name, from } = queue.shift()
    if (collected.has(name)) continue
    const pkg = readPkgJson(name, from)
    if (!pkg) continue
    collected.set(name, pkg.dir)

    // pnpm 隔离结构：该包真实目录的同级 node_modules（.pnpm/<pkgid>/node_modules/）
    // 内是它全部可直接解析的依赖（含 peer），一并平铺收集。
    // 注意：隔离目录内链接名可能是裸名（router-core → @tanstack/router-core），
    // 需读链接目标 package.json 的 name 取真实包名。
    const siblingsDir = dirname(pkg.dir)
    let linkNames = []
    try {
      linkNames = readdirSync(siblingsDir)
    } catch {
      // ignore
    }
    for (const linkName of linkNames) {
      const real = resolvePackageDir(linkName, pkg.dir)
      if (!real) continue
      const realPkgPath = join(real, 'package.json')
      if (!existsSync(realPkgPath)) continue
      let realName = ''
      try {
        realName = JSON.parse(readFileSync(realPkgPath, 'utf-8')).name || ''
      } catch {
        // ignore
      }
      if (realName && !collected.has(realName)) {
        queue.push({ name: realName, from: real })
      }
    }

    // 声明依赖兜底（避免个别依赖未被链接进隔离目录的情况）
    const deps = {
      ...(pkg.data.dependencies || {}),
      ...(pkg.data.peerDependencies || {}),
      ...(pkg.data.optionalDependencies || {}),
    }
    for (const dep of Object.keys(deps)) {
      if (!collected.has(dep)) queue.push({ name: dep, from: pkg.dir })
    }
  }
  return collected
}

const entries = [...collectServerChunkFiles(), join(ROOT, 'server-entry.js')]

const importNames = new Set()
for (const file of entries) {
  if (existsSync(file)) {
    for (const name of collectPackageImports(file)) importNames.add(name)
  }
}

console.log('[stage-server-deps] external deps:', [...importNames].join(', '))

rmSync(STAGE, { recursive: true, force: true })
mkdirSync(STAGE_MODULES, { recursive: true })

const closure = collectDependencyClosure([...importNames])
for (const [name, realDir] of closure) {
  const target = join(STAGE_MODULES, name)
  mkdirSync(dirname(target), { recursive: true })
  cpSync(realDir, target, { recursive: true, dereference: true })
  console.log(`[stage-server-deps] staged ${name} → ${relative(STAGE, target)}`)
}

// 覆盖路径：包名与真实目录不一致（如 @tanstack/react-router 的 exports 子路径）
for (const [name] of closure) {
  if (!existsSync(join(STAGE_MODULES, name))) {
    console.warn(`[stage-server-deps] WARN: ${name} staged but missing`)
  }
}

writeFileSync(
  join(STAGE, 'package.json'),
  JSON.stringify({ name: 'tiwork-backend', private: true, type: 'module' }, null, 2),
  'utf-8',
)

console.log(`[stage-server-deps] done. staged ${closure.size} packages → ${STAGE}`)
