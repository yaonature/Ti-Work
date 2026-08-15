import type { Writable } from 'node:stream'

function isBrokenPipe(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    ['EPIPE', 'ERR_STREAM_DESTROYED'].includes(
      (error as NodeJS.ErrnoException).code ?? '',
    )
  )
}

const brokenStreams = new WeakSet<Writable>()
const guardedStreams = new WeakSet<Writable>()

function guardStream(stream: Writable | null | undefined): void {
  if (!stream || guardedStreams.has(stream)) return
  guardedStreams.add(stream)
  stream.on('error', () => {
    brokenStreams.add(stream)
  })
}

function writeLine(stream: Writable | null | undefined, line: string): void {
  if (!stream || stream.destroyed || stream.writableEnded) return
  guardStream(stream)
  if (brokenStreams.has(stream)) return
  try {
    stream.write(line, (error) => {
      if (error) {
        brokenStreams.add(stream)
      }
    })
  } catch (error) {
    if (isBrokenPipe(error) || error instanceof Error) {
      brokenStreams.add(stream)
      return
    }
    throw error
  }
}

export function logLine(message: string): void {
  writeLine(process.stdout, `${message}\n`)
}

export function errorLine(message: string): void {
  writeLine(process.stderr, `${message}\n`)
}
