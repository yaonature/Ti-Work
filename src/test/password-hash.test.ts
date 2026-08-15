/**
 * G2 contract tests — bcrypt password hashing layer (password-hash.ts).
 *
 * Red line: no storage medium may contain plaintext passwords; bcrypt is salted with a cost factor >= 10.
 * This suite is pure unit tests and needs no Redis.
 */
import { describe, expect, it } from 'vitest'
import {
  hashPassword,
  verifyPasswordHash,
} from '@/server/password-hash'

describe('password-hash (bcrypt)', () => {
  it('hash output is not plaintext and matches the bcrypt format (salt + cost factor)', async () => {
    const plain = 'correct-horse-battery-staple'
    const hash = await hashPassword(plain)

    expect(hash).not.toContain(plain)
    // $2a$ / $2b$ / $2y$ prefix + two-digit cost factor + salt + digest
    expect(hash).toMatch(/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/)
    expect(hash.startsWith('$2b$10$') || hash.startsWith('$2a$10$')).toBe(true)
  })

  it('hashing the same plaintext twice yields different results (fresh salt each time)', async () => {
    const a = await hashPassword('same-password')
    const b = await hashPassword('same-password')
    expect(a).not.toBe(b)
  })

  it('correct password verifies', async () => {
    const hash = await hashPassword('secret-42')
    await expect(verifyPasswordHash('secret-42', hash)).resolves.toBe(true)
  })

  it('wrong password fails verification', async () => {
    const hash = await hashPassword('secret-42')
    await expect(verifyPasswordHash('wrong-pass', hash)).resolves.toBe(false)
  })

  it('empty and very long passwords are accepted as valid input (length constraints live in the route layer)', async () => {
    const short = await hashPassword('x')
    await expect(verifyPasswordHash('x', short)).resolves.toBe(true)

    const long = 'x'.repeat(1000)
    const longHash = await hashPassword(long)
    await expect(verifyPasswordHash(long, longHash)).resolves.toBe(true)
  })

  it('a corrupted hash does not throw; it returns false', async () => {
    await expect(
      verifyPasswordHash('anything', 'not-a-valid-bcrypt-hash'),
    ).resolves.toBe(false)
  })
})
