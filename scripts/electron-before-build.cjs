const { existsSync, readFileSync, readdirSync, statSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const BUILD_DIR = join(ROOT, 'build')
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])

function stripRepeatedUtf8Bom(buffer) {
  let raw = buffer
  while (
    raw.length >= 3 &&
    raw[0] === UTF8_BOM[0] &&
    raw[1] === UTF8_BOM[1] &&
    raw[2] === UTF8_BOM[2]
  ) {
    raw = raw.subarray(3)
  }
  return raw
}

function normalizeNsisBom(filePath) {
  const raw = readFileSync(filePath)
  const normalized = stripRepeatedUtf8Bom(raw)
  if (normalized.length === raw.length) return
  writeFileSync(filePath, normalized)
  console.log(`[electron-before-build] normalized UTF-8 BOM: ${filePath}`)
}

function normalizeBuildNsisFiles() {
  if (!existsSync(BUILD_DIR)) return
  for (const entry of readdirSync(BUILD_DIR)) {
    const fullPath = join(BUILD_DIR, entry)
    if (!statSync(fullPath).isFile()) continue
    if (!/\.(nsh|nsi)$/i.test(entry)) continue
    normalizeNsisBom(fullPath)
  }
}

// electron-builder beforeBuild hook (CJS: loaded by electron-builder via dynamic-import/require).
//
// Returning false means "node_modules is handled externally":
//   1. Skip installOrRebuild - the packaged output does not carry node_modules (excluded via files),
//      backend deps are collected into extraResources (.electron-stage) by scripts/stage-server-deps.mjs,
//      so no electron-rebuild is needed for native modules (better-sqlite3).
//   2. Skip node_modules dependency-tree collection (areNodeModulesHandledExternally=true) -
//      the pnpm collector of electron-builder 26 spawns a `pnpm list --json` child process,
//      which gets blocked in the restricted sandbox when writing the Windows Recent jump list,
//      causing packaging to fail; and this project does not need node_modules inside asar anyway,
//      so collecting it is pure waste.
module.exports = async function electronBeforeBuild() {
  normalizeBuildNsisFiles()
  return false
}
