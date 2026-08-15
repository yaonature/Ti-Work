/**
 * G5 contract tests — Electron shell update manifest fetch (pure logic).
 *
 * Coverage:
 *  - a valid manifest is returned as-is (notes defaults to an empty string)
 *  - null / missing version / missing url / non-object are all treated as no update
 *  - fetch errors (network failure) are treated as no update and never rethrown
 */
import { describe, expect, it } from 'vitest'
import { fetchUpdateManifest } from '../../electron/update-check'
import type { UpdateManifest } from '../../electron/update-check'

describe('fetchUpdateManifest', () => {
  it('a valid manifest is returned in full', async () => {
    const fetchImpl = async (): Promise<UpdateManifest> => ({
      version: '1.21.0',
      notes: 'fixes',
      url: 'https://example.com/tiwork-1.21.0.exe',
    })
    const manifest = await fetchUpdateManifest(
      'https://example.com/latest.json',
      fetchImpl,
    )
    expect(manifest).toEqual({
      version: '1.21.0',
      notes: 'fixes',
      url: 'https://example.com/tiwork-1.21.0.exe',
    })
  })

  it('missing notes is normalized to an empty string', async () => {
    const fetchImpl = async (): Promise<UpdateManifest> => ({
      version: '1.21.0',
      url: 'https://example.com/tiwork.exe',
      notes: '',
    })
    const manifest = await fetchUpdateManifest('u', fetchImpl)
    expect(manifest?.notes).toBe('')
  })

  it('missing version is treated as no update', async () => {
    const fetchImpl = async (): Promise<UpdateManifest> =>
      ({ url: 'https://example.com/x.exe' }) as UpdateManifest
    await expect(fetchUpdateManifest('u', fetchImpl)).resolves.toBe(null)
  })

  it('missing url is treated as no update', async () => {
    const fetchImpl = async (): Promise<UpdateManifest> =>
      ({ version: '1.21.0' }) as UpdateManifest
    await expect(fetchUpdateManifest('u', fetchImpl)).resolves.toBe(null)
  })

  it('a null fetch result is treated as no update', async () => {
    const fetchImpl = async (): Promise<UpdateManifest | null> => null
    await expect(fetchUpdateManifest('u', fetchImpl)).resolves.toBe(null)
  })

  it('a throwing fetch is treated as no update and never rethrown', async () => {
    const fetchImpl = async (): Promise<UpdateManifest | null> => {
      throw new Error('network unreachable')
    }
    await expect(fetchUpdateManifest('u', fetchImpl)).resolves.toBe(null)
  })
})
