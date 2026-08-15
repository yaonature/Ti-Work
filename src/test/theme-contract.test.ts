/**
 * G1 contract tests — ti-work brand theme
 *
 * Based on docs/development-guide.md §4.4 / §8.3 (row G1):
 *  ① theme.ts: ThemeId includes 'ti-work', THEMES has a matching entry, DEFAULT_THEME === 'ti-work'
 *  ② styles.css: every --theme-* variable has a value under [data-theme='ti-work'] (consistent with the hermes-os variable set)
 *  ③ hermes-os-only selectors are all generalized: any rule containing [data-theme='hermes-os'] (except variable blocks)
 *     must list [data-theme='ti-work'] in the same selector list, so ti-work renders identically with no missed selectors
 *  ④ Brand assets: system title / manifest / startup page default theme are all Ti Work
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME, THEMES, isValidTheme } from '../lib/theme'
import type { ThemeId } from '../lib/theme'

const stylesCss = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf-8')
const rootTsx = readFileSync(new URL('../../src/routes/__root.tsx', import.meta.url), 'utf-8')
const manifestJson = JSON.parse(
  readFileSync(new URL('../../public/manifest.json', import.meta.url), 'utf-8'),
) as { name: string; short_name: string }

describe('G1 contract ① — theme.ts registers ti-work and activates it by default', () => {
  it('DEFAULT_THEME is ti-work (activated by default)', () => {
    expect(DEFAULT_THEME).toBe('ti-work')
  })

  it('THEMES includes a ti-work entry (label "Ti Work", with icon and description)', () => {
    const entry = THEMES.find((t) => t.id === 'ti-work')
    expect(entry).toBeDefined()
    expect(entry?.label).toBe('Ti Work')
    expect(entry?.icon).toBeTruthy()
    expect(entry?.description).toBeTruthy()
  })

  it('ThemeId union includes ti-work (isValidTheme allows it)', () => {
    expect(isValidTheme('ti-work')).toBe(true)
    expect('ti-work' satisfies ThemeId).toBe('ti-work')
  })

  it('THEMES entry ids are unique', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('G1 contract ② — styles.css theme variable contract', () => {
  function extractThemeVars(themeId: string): Set<string> {
    const selector = `[data-theme='${themeId}']`
    const start = stylesCss.indexOf(`${selector} {`)
    expect(start).toBeGreaterThan(-1)
    const end = stylesCss.indexOf('}', start)
    const block = stylesCss.slice(start, end)
    const vars = new Set<string>()
    for (const line of block.split('\n')) {
      const match = /^\s*(--[\w-]+)\s*:/.exec(line)
      if (match) vars.add(match[1])
    }
    return vars
  }

  it('[data-theme="ti-work"] variable block exists', () => {
    expect(stylesCss).toContain("[data-theme='ti-work'] {")
  })

  it('ti-work covers all --theme-* variables of hermes-os (consistent rendering)', () => {
    const hermesVars = extractThemeVars('hermes-os')
    const tiWorkVars = extractThemeVars('ti-work')
    expect(hermesVars.size).toBeGreaterThanOrEqual(40)
    // Difference = variables hermes-os has but ti-work lacks; must be empty
    const missing = [...hermesVars].filter((v) => !tiWorkVars.has(v))
    expect(missing).toEqual([])
  })
})

describe('G1 contract ③ — all hermes-os-only selectors are generalized', () => {
  it('every rule containing [data-theme="hermes-os"] (except variable blocks) lists ti-work in the same selector list', () => {
    // Minimal CSS rule scan: "{" enters a rule body, "}" exits; rule bodies don't accumulate selectors;
    // comments (/* */ multiline / // single-line) are skipped entirely so comment text never leaks into selectors.
    // Variable blocks (selector exactly [data-theme='hermes-os']) are exempt — ti-work has its own variable block.
    let selectorBuffer: Array<string> = []
    let insideRule = false
    let inComment = false
    const violations: Array<string> = []
    for (const rawLine of stylesCss.split('\n')) {
      let line = rawLine.trim()
      if (!line) continue
      if (inComment) {
        if (line.includes('*/')) inComment = false
        continue
      }
      if (line.startsWith('//')) continue
      const commentStart = line.indexOf('/*')
      if (commentStart !== -1) {
        line = line.slice(0, commentStart).trim()
        if (line.includes('*/')) line = ''
        else inComment = true
        if (!line) continue
      }
      if (insideRule) {
        if (line.includes('}')) insideRule = false
        continue
      }
      const braceIndex = line.indexOf('{')
      if (braceIndex === -1) {
        selectorBuffer.push(line)
        continue
      }
      const selectorList = [...selectorBuffer, line.slice(0, braceIndex)].join(' ')
      selectorBuffer = []
      insideRule = true
      if (!selectorList.includes("'hermes-os'")) continue
      const trimmed = selectorList.trim()
      // Variable block exemption: selector is exactly [data-theme='hermes-os']
      if (trimmed === "[data-theme='hermes-os']") continue
      if (!selectorList.includes("'ti-work'")) {
        violations.push(selectorList)
      }
    }
    expect(violations).toEqual([])
  })

  it('the startup script __root.tsx includes ti-work in VALID_THEMES and theme color mapping', () => {
    expect(rootTsx).toContain("'ti-work'")
    expect(/DEFAULT_THEME = 'ti-work'/.test(rootTsx)).toBe(true)
    expect(/VALID_THEMES/.test(rootTsx)).toBe(true)
    expect(rootTsx).toContain("'ti-work': '#1D1D20'")
  })
})

describe('G1 contract ④ — brand assets', () => {
  it('__root.tsx system title is Ti Work', () => {
    expect(rootTsx).toContain("title: 'Ti Work'")
  })

  it('PWA manifest app name is Ti Work', () => {
    expect(manifestJson.name).toBe('Ti Work')
    expect(manifestJson.short_name).toBe('Ti Work')
  })
})
