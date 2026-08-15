const { spawn } = require('node:child_process')
const { writeFileSync } = require('node:fs')

const outFile = 'D:\\projects\\Hermes-Studio\\release\\manifest-repro.json'
const env = {
  ...process.env,
  HERMES_HOME: 'D:\\hermes',
  HOME: 'D:\\hermes',
  USERPROFILE: 'D:\\hermes',
  XDG_CONFIG_HOME: 'D:\\hermes',
  GIT_CONFIG_GLOBAL: 'D:\\hermes\\.gitconfig',
}

const child = spawn(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    'D:\\projects\\Hermes-Studio\\.bootstrap-stage\\install.ps1',
    '-Manifest',
    '-HermesHome',
    'D:\\hermes',
    '-InstallDir',
    'D:\\hermes\\hermes-agent',
  ],
  {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
)

let stdout = ''
let stderr = ''

child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8')
})
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8')
})
child.on('error', (error) => {
  writeFileSync(
    outFile,
    JSON.stringify({ kind: 'spawn-error', error: String(error) }, null, 2),
    'utf8',
  )
  process.exit(2)
})
child.on('close', (code) => {
  writeFileSync(
    outFile,
    JSON.stringify(
      {
        kind: 'close',
        code,
        stdoutTail: stdout.slice(-4000),
        stderrTail: stderr.slice(-4000),
      },
      null,
      2,
    ),
    'utf8',
  )
  process.exit(code ?? 0)
})
