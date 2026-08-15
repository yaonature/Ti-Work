#!/usr/bin/env node
/**
 * G0 release gate (Verify Build)
 *
 * Flow: build production artifacts -> start the production server at the project root (temp port) ->
 * health check GET / (SSR home 200) -> production smoke test (SSR home content + gateway status record).
 * Any failed step yields a non-zero exit code and CI rejects the merge.
 *
 * Note: the Hermes gateway (external process) is outside this gate - CI provides no gateway,
 * so /api/ping returns 503 per product semantics when the gateway is missing; that is an
 * expected degradation and does not block the gate.
 *
 * Usage: node scripts/verify-build.mjs
 */
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'

const ROOT = process.cwd()
const PACKAGE_MANAGER = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(command, args) {
  return new Promise((resolve, reject) => {
    // On Windows, pnpm.cmd / scripts must be spawned through a shell (direct CreateProcess throws EINVAL)
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

async function waitForHealthy(base, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/`)
      if (res.ok) return
      lastError = new Error(`GET / returned HTTP ${res.status}`)
    } catch (err) {
      lastError = err
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw lastError ?? new Error(`Server did not become ready within ${timeoutMs}ms`)
}

async function smoke(base) {
  console.log('[verify-build] 3/3 production smoke test...')

  // 1) SSR home page: 200 and real HTML skeleton output (SSR pipeline intact)
  const home = await fetch(`${base}/`)
  if (!home.ok) throw new Error(`GET / returned HTTP ${home.status}`)
  const html = await home.text()
  if (html.length < 500) throw new Error(`GET / returned too little content (${html.length} chars), SSR may not have output`)
  console.log(`[verify-build]   ok SSR home 200 (${html.length} chars)`)

  // 2) Gateway status record (non-blocking): the Hermes gateway is an external dependency;
  //    when CI has no gateway, 503 is an expected degradation
  try {
    const ping = await fetch(`${base}/api/ping`)
    console.log(`[verify-build]   - /api/ping returned HTTP ${ping.status}${ping.status === 200 ? ' (gateway available)' : ' (gateway degraded, external dependency not running)'}`)
  } catch {
    console.log('[verify-build]   - /api/ping unreachable (gateway not running, external dependency degraded)')
  }
}

async function main() {
  const start = Date.now()
  console.log('[verify-build] 1/3 building production artifacts...')
  await run(PACKAGE_MANAGER, ['exec', 'vite', 'build'])

  const port = await getFreePort()
  const base = `http://127.0.0.1:${port}`

  console.log(`[verify-build] 2/3 starting production server (port ${port}, cwd=${ROOT})...`)
  // Start the production server at the project root: dist/server/server.js is an SSR bundle that
  // externalizes node_modules deps (react etc.), so it must run where those deps resolve; the server writes no data.
  const server = spawn('node', ['server-entry.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  })
  const serverExited = new Promise((resolve) => server.once('exit', resolve))

  try {
    await waitForHealthy(base)
    await smoke(base)
    console.log(
      `[verify-build] passed in ${((Date.now() - start) / 1000).toFixed(1)}s`,
    )
  } finally {
    server.kill()
    await serverExited
  }
}

main().catch((err) => {
  console.error(`[verify-build] failed: ${err.message}`)
  process.exit(1)
})
