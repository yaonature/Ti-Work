import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { vi } from 'vitest'

export interface TempDirHarness {
  dir: string
  path: (...segments: Array<string>) => string
  removeEntries: (entries: Array<string>) => void
  cleanup: () => void
}

export interface TempWorkspaceHarness extends TempDirHarness {
  mockCwdAndResetModules: () => void
}

function removePathWithRetry(path: string, attempts = 10): void {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(path, { recursive: true, force: true })
      if (!existsSync(path)) return
    } catch {
      // Briefly retry while the file is still locked to avoid cleanup leftovers from delayed Windows handle release.
    }
    if (i < attempts - 1) {
      const sleepUntil = Date.now() + 50
      while (Date.now() < sleepUntil) {
        // Synchronous wait keeps test teardown simple with no extra async tasks.
      }
    }
  }
}

export function createTempDirHarness(prefix = 'ti-work-temp-'): TempDirHarness {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  return {
    dir,
    path: (...segments) => join(dir, ...segments),
    removeEntries: (entries) => {
      for (const entry of entries) {
        removePathWithRetry(join(dir, entry))
      }
    },
    cleanup: () => {
      removePathWithRetry(dir)
    },
  }
}

export function createTempWorkspaceHarness(
  prefix = 'ti-work-workspace-',
): TempWorkspaceHarness {
  const harness = createTempDirHarness(prefix)
  return {
    ...harness,
    mockCwdAndResetModules: () => {
      vi.spyOn(process, 'cwd').mockReturnValue(harness.dir)
      vi.resetModules()
    },
  }
}
