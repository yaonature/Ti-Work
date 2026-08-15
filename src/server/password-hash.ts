/**
 * Password hashing wrapper (bcrypt).
 *
 * G2 red line: user passwords must always be bcrypt-hashed before persisting; plaintext must
 * never appear in any storage medium (Redis/file). bcrypt embeds its own salt, so hashing the
 * same plaintext twice yields different results; verify uses timing-safe comparison.
 */
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

/**
 * bcrypt-hash a plaintext password (bcryptjs async API, to avoid blocking the event loop).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

/**
 * Verify whether the plaintext matches the stored hash (salt verification included;
 * bcryptjs comparison is timing-safe internally).
 */
export async function verifyPasswordHash(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
