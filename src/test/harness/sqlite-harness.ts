/**
 * SQLite integration test harness
 *
 * Contract tests use real better-sqlite3 on-disk files (in a temp directory); never mocked.
 * Each test gets its own temp directory so tests never pollute each other and can run in parallel.
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

export interface SqliteHarness {
  db: Database.Database
  dir: string
  cleanup: () => void
}

/**
 * On Windows, better-sqlite3 releases file handles lazily: a bare rmSync(dir, recursive)
 * silently fails (returns success but the directory remains). Delete the data file first,
 * then the directory, with short retries.
 */
function removeDirWithRetry(dir: string, attempts = 10): void {
  const dataFile = join(dir, 'harness.db')
  for (let i = 0; i < attempts; i++) {
    try {
      // Delete the file first (once the handle is released), then the directory
      rmSync(dataFile, { force: true })
      rmSync(dir, { recursive: true, force: true })
      if (!existsSync(dir)) return
    } catch {
      // Handle still in use; wait, then retry
    }
    if (i < attempts - 1) {
      const sleepUntil = Date.now() + 50
      while (Date.now() < sleepUntil) {
        // Synchronous wait to avoid an async leak window
      }
    }
  }
}

export function createSqliteHarness(): SqliteHarness {
  const dir = mkdtempSync(join(tmpdir(), 'ti-work-sqlite-'))
  const db = new Database(join(dir, 'harness.db'))
  return {
    db,
    dir,
    cleanup: () => {
      db.close()
      removeDirWithRetry(dir)
    },
  }
}
