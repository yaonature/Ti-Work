/**
 * Redis integration test harness
 *
 * Contract tests use real Redis (direct ioredis connection); never mocked.
 * The connection URL comes from the TI_WORK_TEST_REDIS_URL env var (provided by the CI redis service).
 * When the variable is unset the whole contract suite is skipped (a missing environment is a legitimate skip).
 */
import { Redis } from 'ioredis'

export function getTestRedisUrl(): string | null {
  const url = process.env.TI_WORK_TEST_REDIS_URL
  return url && url.trim().length > 0 ? url.trim() : null
}

/**
 * Returns a connected, ready real Redis instance. The caller must call quit().
 * lazyConnect=false only schedules the connection for the next tick, so the first command
 * is issued before the handshake completes, which together with enableOfflineQueue=false
 * throws a spurious "Stream isn't writeable" failure.
 * That is why we use lazyConnect=true + await connect() to explicitly wait for ready before returning.
 */
export async function createRedisHarness(url: string): Promise<Redis> {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy: () => null, // fail fast — no background reconnection storms in tests
  })
  await client.connect()
  await client.ping()
  return client
}

/** Unique stream/group name prefix for tests, to avoid colliding with real data. */
export function harnessPrefix(suffix: string): string {
  return `ti-work:harness:${suffix}`
}
