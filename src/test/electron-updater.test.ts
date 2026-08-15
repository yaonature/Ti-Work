/**
 * G5 contract tests — Electron shell auto-update state machine (pure functions).
 *
 * Coverage:
 *  - parseVersion: semantic version parsing (including pre-release suffixes)
 *  - isNewerVersion: version comparison (major/minor/patch levels, invalid input)
 *  - nextUpdateState: full update state machine transitions (idle→checking→available→downloading→installing,
 *    plus not-available / error / dismiss back to idle)
 *  - shouldCheckForUpdates: check timing (always on first check / skip within interval / recheck after interval)
 */
import { describe, expect, it } from 'vitest'
import {
  isNewerVersion,
  nextUpdateState,
  parseVersion,
  shouldCheckForUpdates,
} from '../../electron/updater'

describe('parseVersion', () => {
  it('parses a standard semver version', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 })
  })

  it('ignores pre-release/build suffixes', () => {
    expect(parseVersion('1.2.3-beta.1')).toEqual({ major: 1, minor: 2, patch: 3 })
    expect(parseVersion('1.2.3+build.42')).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it('an invalid version returns null', () => {
    expect(parseVersion('')).toBe(null)
    expect(parseVersion('abc')).toBe(null)
    expect(parseVersion('1.2')).toBe(null)
    expect(parseVersion('1.2.3.4')).toBe(null)
  })
})

describe('isNewerVersion', () => {
  it('patch upgrade detection', () => {
    expect(isNewerVersion('1.2.3', '1.2.4')).toBe(true)
    expect(isNewerVersion('1.2.4', '1.2.3')).toBe(false)
  })

  it('minor / major upgrade detection', () => {
    expect(isNewerVersion('1.2.9', '1.3.0')).toBe(true)
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(true)
  })

  it('the same version is not an update', () => {
    expect(isNewerVersion('1.2.3', '1.2.3')).toBe(false)
  })

  it('invalid input is never an update', () => {
    expect(isNewerVersion('1.2.3', 'not-a-version')).toBe(false)
    expect(isNewerVersion('not-a-version', '1.2.4')).toBe(false)
  })
})

describe('nextUpdateState', () => {
  it('check triggers the checking state', () => {
    const s = nextUpdateState({ status: 'idle' }, { type: 'check' })
    expect(s).toEqual({ status: 'checking', currentVersion: undefined })
  })

  it('a new version being found enters available and records the version', () => {
    const s = nextUpdateState({ status: 'checking' }, { type: 'found', version: '1.3.0' })
    expect(s.status).toBe('available')
    expect(s.latestVersion).toBe('1.3.0')
  })

  it('no new version enters not-available', () => {
    const s = nextUpdateState({ status: 'checking' }, { type: 'not-found' })
    expect(s.status).toBe('not-available')
  })

  it('a failed check enters error with the message', () => {
    const s = nextUpdateState({ status: 'checking' }, { type: 'error', message: 'network down' })
    expect(s.status).toBe('error')
    expect(s.errorMessage).toBe('network down')
  })

  it('full chain: available → download → install', () => {
    const available = nextUpdateState(
      { status: 'checking' },
      { type: 'found', version: '1.3.0' },
    )
    const downloading = nextUpdateState(available, { type: 'download-started' })
    expect(downloading.status).toBe('downloading')
    expect(downloading.latestVersion).toBe('1.3.0')
    const installing = nextUpdateState(downloading, { type: 'download-finished' })
    expect(installing.status).toBe('installing')
  })

  it('dismiss returns to idle', () => {
    const s = nextUpdateState(
      { status: 'available', latestVersion: '1.3.0' },
      { type: 'dismiss' },
    )
    expect(s).toEqual({ status: 'idle', latestVersion: undefined })
  })
})

describe('shouldCheckForUpdates', () => {
  const INTERVAL = 60_000

  it('checks immediately when never checked before', () => {
    expect(shouldCheckForUpdates(null, 1_000, INTERVAL)).toBe(true)
  })

  it('skips within the interval', () => {
    expect(shouldCheckForUpdates(1_000, 30_000, INTERVAL)).toBe(false)
  })

  it('rechecks after the interval has passed', () => {
    expect(shouldCheckForUpdates(1_000, 61_000, INTERVAL)).toBe(true)
  })
})
