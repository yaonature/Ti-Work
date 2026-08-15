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
  return false
}
