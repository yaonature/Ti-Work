export type ThemeId =
  | 'ti-work'
  | 'hermes-os'
  | 'hermes-official'
  | 'hermes-classic'
  | 'hermes-slate'
  | 'hermes-mono'

export const THEMES: Array<{
  id: ThemeId
  label: string
  description: string
  icon: string
}> = [
  {
    id: 'ti-work',
    label: 'Ti Work',
    description: 'CC Switch 品牌蓝企业主题',
    icon: '◆',
  },
  {
    id: 'hermes-os',
    label: 'Hermes OS',
    description: '电光蓝风格的智能体操作系统主题',
    icon: '◈',
  },
  {
    id: 'hermes-official',
    label: 'Hermes Official',
    description: '海军蓝与靛蓝组合的旗舰主题',
    icon: '⚕',
  },
  {
    id: 'hermes-classic',
    label: 'Hermes Classic',
    description: '深炭黑底配铜色点缀',
    icon: '🔶',
  },
  {
    id: 'hermes-slate',
    label: '石板',
    description: '冷蓝色开发者主题',
    icon: '🔷',
  },
  {
    id: 'hermes-mono',
    label: '单色',
    description: '简洁的黑白灰主题',
    icon: '◐',
  },
]

const STORAGE_KEY = 'hermes-theme'
export const DEFAULT_THEME: ThemeId = 'ti-work'
const THEME_SET = new Set<ThemeId>(THEMES.map((theme) => theme.id))

// ─── Light / dark mode ────────────────────────────────────────────────────────
// 模式独立于主题族（data-theme），由 <html data-mode="light|dark"> 承载。
// 深色模式同时保留 .dark class（全仓 Tailwind dark: 变体依赖它）。

export type ThemeMode = 'light' | 'dark'

const MODE_STORAGE_KEY = 'hermes-theme-mode'
export const DEFAULT_MODE: ThemeMode = 'dark'

export function getMode(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    return DEFAULT_MODE
  }
}

export function setMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-mode', mode)
  root.classList.toggle('dark', mode === 'dark')
  root.style.setProperty('color-scheme', mode)
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

export function isValidTheme(
  value: string | null | undefined,
): value is ThemeId {
  return typeof value === 'string' && THEME_SET.has(value as ThemeId)
}

export function getTheme(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT_THEME
  const stored = localStorage.getItem(STORAGE_KEY)
  return isValidTheme(stored) ? stored : DEFAULT_THEME
}

export function setTheme(theme: ThemeId): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  setMode(getMode())
  localStorage.setItem(STORAGE_KEY, theme)
}
